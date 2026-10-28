import {expect, Page, APIRequestContext} from './consoleTest';
import {fetchPlayerModel, openMandatoryAnnounce, openQuickWheel, openZoomViewer, press, sendPlayerInput, settle, waitForBoardHome} from './consoleStart';

/*
 * THE PARLIAMENT'S SHARED E2E DRIVER (Turmoil Redux) — the readers and the
 * presses every parliament spec speaks through, so a rework of the sitting's
 * markup changes ONE file. Witnesses read the section's own attributes and
 * the server's own model; presses are act → verify → retry (`pressUntil`).
 */

export const PARLIAMENT_PRESETS = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;

export type ParliamentPreset = typeof PARLIAMENT_PRESETS[number];

export type ParliamentWire = {
  waitingFor?: {
    type: string; promptId?: number; cards?: Array<{name: string}>; options?: Array<{title: string | {message: string}}>;
    /** THE SITTING'S CONFIRMATION («Закрыть заседание», the soft gates) — the seat's own close, never a barrier list. */
    parliamentPhasePrompt?: {stage: string; generation?: number; final?: boolean; seq?: number; early?: boolean};
    /** The shared distribution's marker (an `and` of one amount per holder): N units over the listed holders. */
    cardResourceDistributionPrompt?: {amount: number; cardResource: string; cards: Array<{name: string}>};
  };
  game: {
    phase: string; generation: number;
    parliament?: {rulingParty?: string;
      /** The seats that have not closed the last sitting yet (the soft gates) — a fact, never a wait. */
      sitting?: {generation: number; seq: number; final: boolean; pending: Array<string>};
      phase?: {step: string; generation?: number; pending?: {player: string}; outcomes?: Array<Record<string, unknown>>; closed?: Array<string>;
      summary?: {
        agenda?: {player: string; from: number; to: number; bonus?: string; answer?: {stock?: Record<string, number>}}; winner: {player?: string; instance?: string}; refreshed: Array<unknown>;
        support?: Array<{party: string; gained: number; total: number}>;
      }}};
  };
  thisPlayer: {color: string; cardsInHandNbr: number; terraformRating: number; plants: number; heatProduction: number; megacreditProduction: number};
};

export const parliamentWire = async (request: APIRequestContext, id: string): Promise<ParliamentWire> =>
  await fetchPlayerModel(request, id) as unknown as ParliamentWire;

export const parliament = (page: Page) => page.locator('.con-parl');
export const sittingSurface = (page: Page) => page.locator('.con-sit');
export const mandatoryPlate = (page: Page) => page.locator('.con-mandatory');

/** The sitting's stage on screen (the section's own attribute — the server's step under the page cursor). */
export async function sittingStage(page: Page): Promise<string> {
  return (await page.locator('.con-parl').getAttribute('data-sitting-stage')) ?? '';
}

/** The reward stage's step for this seat (`reading` · `choice` · `intake` · `placement` · `waiting` · `received`). */
export async function sittingStep(page: Page): Promise<string> {
  return (await page.locator('.con-sit').getAttribute('data-sit-step')) ?? '';
}

/** The command bar's HOT verb (the sitting's A), by its label. */
export async function hotVerb(page: Page): Promise<string> {
  const labels = await page.locator('.con-cmdbar__cmd--hot .con-cmdbar__label').allTextContents();
  return labels.map((l) => l.trim()).join(' | ');
}

/** The sitting's stages in walk order («Обновление»: the renewal is a page of its own before the results); the retired «closing» page is the RESULTS stage. */
const SITTING_STAGE_ORDER = ['verdict', 'enact', 'reward', 'renewal', 'results'];
const RETIRED_SITTING_STAGES: Record<string, string> = {closing: 'results'};

/**
 * Bring the sitting to `stage` (the soft gates): every page from the VERDICT on turns BY ITSELF — the walk plays the
 * whole sitting from its records, and the one press of a sitting is «Закрыть заседание» on the results
 * (`closeSitting`). The walk is awaited until it has reached — or passed — `stage`. False when it never gets there
 * (a law asking ANOTHER seat holds the reward page: let that seat answer — `answerAsksAs`).
 */
export async function turnTo(page: Page, stage: string, timeout = 60_000): Promise<boolean> {
  const target = RETIRED_SITTING_STAGES[stage] ?? stage;
  const rank = (s: string) => SITTING_STAGE_ORDER.indexOf(s);
  const reached = async () => rank(await sittingStage(page)) >= rank(target);
  try {
    await expect.poll(reached, {timeout}).toBe(true);
    return true;
  } catch {
    return false;
  }
}

/**
 * THE VIEWER'S OWN PASS, on screen — the quick wheel's «Пас» (↓) and its confirm (A), as a player does it. Through the
 * viewer's OWN submit: the response that carries the whole sitting (the soft gates — a `pass` fixture is one pass
 * away from it) is the transport's, so the generation scene plays and rises into the sitting. act → verify (the
 * SERVER: the viewer's action menu is gone) → retry only while the menu provably still stands.
 */
export async function passOnScreen(page: Page, request: APIRequestContext, viewer: string): Promise<void> {
  const menuStands = async () => {
    const wf = (await parliamentWire(request, viewer)).waitingFor;
    return wf?.type === 'or' && JSON.stringify(wf).includes('Pass for this generation');
  };
  await expect.poll(menuStands, {timeout: 30_000, message: 'the viewer holds its action menu with the pass'}).toBe(true);
  // The quick wheel is a board-home instrument: a fixture may open on a workspace (the Parliament's overview) first —
  // B «На поле» takes it down (act → verify → retry), then the board home settles.
  for (let i = 0; i < 4 && await parliament(page).count() > 0; i++) {
    await press(page, 'Escape', 900);
  }
  await expect(parliament(page), 'the Parliament steps aside for the board before the pass').toHaveCount(0, {timeout: 15_000});
  await waitForBoardHome(page);
  const confirm = page.locator('.con-confirm');
  // «Пас» is the BASIC wheel's (LT — Comma) ↓ slot; on a quick wheel the direction press IS the activation.
  const wheel = page.locator('.con-quick');
  const passSlot = page.locator('.con-quick [data-quick-id="pass"]');
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await confirm.count() === 0) {
      for (let i = 0; i < 6 && await wheel.count() === 0; i++) {
        await press(page, 'Comma', 700);
      }
      await expect(passSlot, 'the basic wheel offers the pass').toHaveCount(1, {timeout: 10_000});
      await press(page, 'ArrowDown', 700);
    }
    await expect(confirm, 'the pass always confirms').toHaveCount(1, {timeout: 10_000});
    await press(page, 'Enter', 600);
    try {
      await expect.poll(async () => !(await menuStands()), {timeout: 15_000}).toBe(true);
      return;
    } catch {
      // still standing 15 s after the press: it was swallowed — press again
    }
  }
  expect(await menuStands(), 'the viewer\'s pass landed').toBe(false);
}

/**
 * ENTER THE SITTING THE WAY A PLAYER DOES (the soft gates): a `pass` fixture (the `-assembly` tables) stands ONE PASS
 * before its sitting — the viewer passes on screen (`passOnScreen`), the whole sitting rides that response, and it
 * comes up: risen by the generation scene, or behind its plate (opened here). Returns once the Parliament stands; the
 * walk then plays from the VERDICT by itself. A wire read BEFORE this call is the table as it stood before the
 * sitting AND before the production phase (the pass pays the income too).
 */
export async function enterSittingByPass(page: Page, request: APIRequestContext, viewer: string): Promise<void> {
  await passOnScreen(page, request, viewer);
  await awaitSittingUp(page);
}

/**
 * The sitting COMES UP on the viewer's screen — risen by the generation scene, or behind its plate (opened here) —
 * after the pass that started it, whoever made it (the viewer on screen — `enterSittingByPass` — or the last seat over
 * the API, when the sitting reaches this screen by the poll / the socket).
 */
export async function awaitSittingUp(page: Page): Promise<void> {
  await expect.poll(async () => await parliament(page).count() > 0 || await mandatoryPlate(page).count() > 0,
    {timeout: 60_000, message: 'the sitting comes up after the pass (risen by the scene, or its plate)'}).toBe(true);
  if (await parliament(page).count() === 0) {
    expect(await openMandatoryAnnounce(page), 'the plate opens the sitting').toBe(true);
  }
  await expect(parliament(page)).toHaveCount(1, {timeout: 30_000});
}

/** The seat's CONFIRMATION of its sitting stands («Закрыть заседание» — the server's marker). */
async function confirmationStands(request: APIRequestContext, seat: string): Promise<boolean> {
  return (await parliamentWire(request, seat)).waitingFor?.parliamentPhasePrompt?.stage === 'close';
}

/** CLOSE THE SITTING for `seat` over the API (the other seat of a two-seat fixture) — its own «Закрыть заседание». */
export async function closeSittingAs(request: APIRequestContext, seat: string): Promise<void> {
  await expect.poll(() => confirmationStands(request, seat), {timeout: 30_000, message: `${seat} holds the confirmation of its sitting`}).toBe(true);
  const wire = await parliamentWire(request, seat);
  await sendPlayerInput(request, seat, {type: 'option', promptId: wire.waitingFor?.promptId} as never);
}

/**
 * THE CONFIRMATION ANSWERED FROM THE VIEWER'S OWN SCREEN — A on the results («Закрыть заседание»): act → verify →
 * retry, where the verify is the SERVER's record and it is given the time a loaded runner needs.
 *
 * Both halves were paid for. A blind `press(Enter)` is swallowed whenever a beat still holds the pad (the Deck, a
 * loaded runner), and the miss surfaced a minute later as «the generation never advanced». And a hand-rolled
 * `pressUntil(Enter, …, {settleMs: 1500})` re-pressed whenever the answer took longer than its settle: the SECOND
 * A landed on whatever the first one had opened. So the confirmation must STAND before the press, and a retry happens
 * only while it provably still stands 10 s later.
 */
export async function closeSitting(page: Page, request: APIRequestContext, viewer: string): Promise<void> {
  await expect.poll(() => confirmationStands(request, viewer), {timeout: 30_000, message: 'the viewer holds the confirmation of its sitting'}).toBe(true);
  for (let attempt = 0; attempt < 3; attempt++) {
    await press(page, 'Enter', 400);
    try {
      await expect.poll(async () => !(await confirmationStands(request, viewer)), {timeout: 10_000}).toBe(true);
      return;
    } catch {
      // still standing 10 s after the press: it was swallowed — press again
    }
  }
  expect(await confirmationStands(request, viewer), 'A on the results closes the viewer\'s sitting').toBe(false);
}

/** Answer `seat`'s standing resolution asks over the API with the plainest legal answer until none stands (a card take: every card; a pick: the first). */
export async function answerAsksAs(request: APIRequestContext, seat: string, rounds = 6): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    const wire = await parliamentWire(request, seat);
    const wf = wire.waitingFor;
    if (wf === undefined || wf.parliamentPhasePrompt !== undefined) {
      return;
    }
    if (wf.type === 'card') {
      await sendPlayerInput(request, seat, {type: 'card', cards: (wf.cards ?? []).map((c) => c.name).slice(0, 1), promptId: wf.promptId} as never);
    } else if (wf.type === 'and' && wf.cardResourceDistributionPrompt !== undefined) {
      // The shared DISTRIBUTION (an `and` of one amount per holder): the plainest COMPLETE layout —
      // everything onto the first holder. The server refuses any other sum, so a partial answer is no answer.
      const amount = wf.cardResourceDistributionPrompt.amount;
      const responses = (wf.options ?? []).map((_, n) => ({type: 'amount', amount: n === 0 ? amount : 0}));
      await sendPlayerInput(request, seat, {type: 'and', responses, promptId: wf.promptId} as never);
    } else {
      return;
    }
  }
}

/** PASS for `seat` over the API — the action menu's own option, found by the server's title (the menu is the one sanctioned title match). */
export async function passAs(request: APIRequestContext, seat: string): Promise<void> {
  const wire = await parliamentWire(request, seat);
  const wf = wire.waitingFor;
  expect(wf?.type, `${seat} holds the action menu`).toBe('or');
  const titleOf = (o: {title: string | {message: string}}) => typeof o.title === 'string' ? o.title : o.title.message;
  const index = (wf?.options ?? []).findIndex((o) => /^pass\b/i.test(titleOf(o).trim()));
  expect(index, `a Pass option among ${(wf?.options ?? []).map(titleOf).join(' | ')}`).toBeGreaterThanOrEqual(0);
  await sendPlayerInput(request, seat, {type: 'or', index, response: {type: 'option'}, promptId: wf?.promptId} as never);
}

/**
 * Nothing of the parliament sticks out of the viewport, no block spills its
 * box, and NOTHING SCROLLS (a scroll container under the workspace is a
 * defect — the fit engines exist so nothing has to).
 */
export async function expectParliamentFits(page: Page, label: string, rootSelector = '.con-parl'): Promise<void> {
  const problems = await page.evaluate((rootSel) => {
    const root = document.querySelector(rootSel);
    if (root === null) {
      return [`no root ${rootSel}`];
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const out: Array<string> = [];
    const name = (el: Element) => el.className.toString().split(' ')[0];
    const blocks = '.con-parl__gov, .con-parl__slot, .con-parl__stage, .con-sit__panel--on, .con-sit__row, .con-sit__results,' +
      ' .con-iyield, .con-iyield__reading, .con-preact, .con-wreward, .con-sit__zone--on, .con-extdraw__cards, .con-cards__slot, .con-task,' +
      // v5: the middle zone is a BAND and a BODY — the band's line and the results panel's two sections.
      ' .con-cards__verdictbar, .con-band, .con-band__line, .con-sit__payouts, .con-sit__payout, .con-sit__table,' +
      // The other parliament chassis a gallery photographs: the announce plate, the fullscreen inspect's columns and its bar, the party
      // composer's two columns (the chairman's seat pick renders inside `.con-parl__stage`, listed above). NOT the playground's
      // catalog as a whole: it is a list that grows with every shipped resolution inside the stand's own scroll area — its
      // pieces are measured, its height is not a claim.
      ' .con-mandatory, .con-mandatory__body, .con-zoom-asidecol, .con-zoom-sidecol, .con-zoom__bar';
    const scoped = root.matches(blocks) ? [root as HTMLElement] : [];
    for (const el of [...scoped, ...Array.from(root.querySelectorAll<HTMLElement>(blocks))]) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') {
        continue;
      }
      if (r.right > vw + 1 || r.bottom > vh + 1 || r.left < -1 || r.top < -1) {
        out.push(`off-screen ${name(el)} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.right)},${Math.round(r.bottom)}`);
      }
      const cs = getComputedStyle(el);
      if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX !== 'visible') {
        out.push(`clipped-x ${name(el)} ${el.scrollWidth}>${el.clientWidth}`);
      }
      if (el.scrollHeight > el.clientHeight + 2 && cs.overflowY !== 'visible') {
        out.push(`clipped-y ${name(el)} ${el.scrollHeight}>${el.clientHeight}`);
      }
      // A POSE OF THE SITTING IS A FIXED BODY: the stage's box is the middle zone's BODY (v5: `--con-parl-mid-h`
      // minus the reading band), and a
      // pose that spills paints over the Agenda track with nothing clipped — `overflow: visible` hides it from
      // the clip checks above, so the on-pose is asked directly (measured with the v2 results card: four rows and
      // the head ran ~50 px past the tier on every profile; on the Deck the whole track was covered).
      if (el.matches('.con-sit__panel--on') && el.scrollHeight > el.clientHeight + 2) {
        out.push(`spills-y ${name(el)} ${el.scrollHeight}>${el.clientHeight} (the pose runs past the stage's tier)`);
      }
    }
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
      // The console's ONE sanctioned scroll instrument (`ConsoleScrollArea` — the inspect's rules prose on a
      // handheld, with its own scroll badge) is not a stray scroll container; everything else is.
      if (el.classList.contains('con-scroll-area__viewport')) {
        continue;
      }
      const cs = getComputedStyle(el);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll' || cs.overflowX === 'auto' || cs.overflowX === 'scroll') &&
          (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) {
        out.push(`scroll-container ${name(el)} ${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight}`);
      }
    }
    return out;
  }, rootSelector);
  expect(problems, `${label}: layout problems`).toEqual([]);
}

/**
 * A one-line STATUS RAIL is HONEST: a member with more text than room
 * ellipsizes INSIDE ITS OWN BOX (the box that clips it declares the ellipsis),
 * and no member is cut by an ANCESTOR's overflow — a hard cut at a panel edge
 * says nothing about what was lost («ТРЕБОВАНИЕ ПОКА НЕ ВЫПО» on the Deck).
 * `expectParliamentFits` cannot see this: the rail's own box fits, the loss is
 * inside it.
 */
export async function expectRailHonest(page: Page, label: string, railSelector: string): Promise<void> {
  const problems = await page.evaluate((railSel) => {
    const rail = document.querySelector<HTMLElement>(railSel);
    if (rail === null) {
      return [`no rail ${railSel}`];
    }
    const out: Array<string> = [];
    const name = (el: Element) => el.className.toString().split(' ')[0];
    const clips = (cs: CSSStyleDeclaration) => cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
    const quote = (el: Element) => `«${(el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)}»`;
    const members = Array.from(rail.querySelectorAll<HTMLElement>('*')).filter((el) =>
      Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== ''));
    for (const leaf of members) {
      const r = leaf.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) {
        continue;
      }
      let hidden = false;
      for (let a: HTMLElement | null = leaf; a !== null && a !== rail.parentElement; a = a.parentElement) {
        const acs = getComputedStyle(a);
        if (acs.visibility === 'hidden' || Number(acs.opacity) === 0 || acs.display === 'none') {
          hidden = true;
          break;
        }
      }
      if (hidden) {
        continue;
      }
      const cs = getComputedStyle(leaf);
      // An ellipsis renders only on a BLOCK container's own text: on a flex/grid box the text is an anonymous
      // item and `text-overflow` is declared but never painted (the chassis pill cut «Принятая резо» that way).
      const honest = clips(cs) && cs.textOverflow === 'ellipsis' && cs.whiteSpace === 'nowrap' && !/flex|grid/.test(cs.display);
      if (leaf.scrollWidth > leaf.clientWidth + 1 && !honest) {
        out.push(`cut-in-place ${name(leaf)} ${leaf.scrollWidth}>${leaf.clientWidth} without an ellipsis (${cs.display}) ${quote(leaf)}`);
      }
      for (let a = leaf.parentElement; a !== null && a !== rail.parentElement; a = a.parentElement) {
        if (!clips(getComputedStyle(a))) {
          continue;
        }
        const ar = a.getBoundingClientRect();
        const left = ar.left + a.clientLeft;
        const right = left + a.clientWidth;
        if (r.left < left - 1 || r.right > right + 1) {
          out.push(`cut-by-ancestor ${name(leaf)} ${Math.round(r.left)}..${Math.round(r.right)} by ${name(a)} ${Math.round(left)}..${Math.round(right)} ${quote(leaf)}`);
          break;
        }
      }
    }
    return out;
  }, railSelector);
  expect(problems, `${label}: status rail members`).toEqual([]);
}

/** The leak detector's own verdict: no stranded prompt was ever reported on this page. */
export async function armLeakWitness(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__stranded: Array<string>};
    w.__stranded = [];
    const orig = console.warn.bind(console);
    const t0 = performance.now();
    console.warn = (...args: Array<unknown>) => {
      const text = args.map(String).join(' ');
      if (text.includes('STRANDED PROMPT')) {
        // A red names the MOMENT, not just the fact: which surfaces stood, the frames, the holds, the transport.
        type Ready = {wsFrames?: Array<string>, holds?: Array<string>, transport?: {waitingForType?: string, requestInProgress?: boolean}};
        const ready = (window as unknown as {__conReady?: () => Ready}).__conReady?.();
        const count = (sel: string) => document.querySelectorAll(sel).length;
        const at = {
          t: Math.round(performance.now() - t0),
          extdraw: count('.con-extdraw'), reveal: count('.con-reveal'), parl: count('.con-parl'), task: count('.con-task'),
          page: document.querySelector('.con-parl')?.getAttribute('data-sitting-page') ?? '',
          beat: document.querySelector('.con-parl')?.getAttribute('data-sitting-beat') ?? '',
          frames: ready?.wsFrames, holds: ready?.holds, wf: ready?.transport?.waitingForType, inFlight: ready?.transport?.requestInProgress,
        };
        w.__stranded.push(`${text} @ ${JSON.stringify(at)}`);
      }
      orig(...args);
    };
  });
}

export async function strandedReports(page: Page): Promise<Array<string>> {
  return page.evaluate(() => (window as unknown as {__stranded?: Array<string>}).__stranded ?? []);
}

/** Open the Parliament workspace from the quick wheel (RT → down): the direction press IS the activation. */
export async function openParliament(page: Page): Promise<void> {
  // A LEAVING root is not an open Parliament: the section stays mounted for its whole leave (v3 В1), so
  // counting it would skip the open and hand the caller a surface that is gone a beat later.
  await expect(page.locator('.con-parl[data-parl-leaving]'), 'a leaving Parliament finishes its leave').toHaveCount(0, {timeout: 20_000});
  for (let i = 0; i < 6 && await parliament(page).count() === 0; i++) {
    await openQuickWheel(page);
    await press(page, 'ArrowDown', 1400);
  }
  await expect(parliament(page)).toHaveCount(1, {timeout: 15_000});
  await settle(page, {timeoutMs: 15_000});
}

/** The browse layer's focus ZONE (`data-zone` on the root) — Парламент v8: parties · ruler · effects · voting · engine · agenda. */
export async function parliamentZone(page: Page): Promise<string> {
  return (await parliament(page).getAttribute('data-zone')) ?? '';
}

export type ParliamentFocusZone = 'ruler' | 'voting' | 'parties' | 'effects' | 'engine' | 'agenda';

/**
 * ONE press that moves the cursor TOWARDS `zone` from `at` on the v8 ring (mirrors `parliamentNavigation.ts`):
 * the CHAMBER — the opposition's benches (▲ ▼ walk them; ▼ past the last → «ВАШИ ЭФФЕКТЫ»; ▶ → the ruler), the
 * ruler on the dais (◀ → the benches, ▶ → the table, ▼ → the effects), «ВАШИ ЭФФЕКТЫ» (▲ → the ruler, ◀ → the
 * benches, ▶ → the table, ▼ → the quest) — the TABLE's bills (◀ ▶ walk them; ◀ past the first → the ruler,
 * ▼ → the career) — the QUEST (▲ → the effects, ▶ → the career) — the CAREER, one stop (◀ → the quest, ▲ → the table).
 */
const RING_STEP: Record<ParliamentFocusZone, Record<ParliamentFocusZone, string>> = {
  voting: {voting: '', ruler: 'ArrowLeft', parties: 'ArrowLeft', effects: 'ArrowLeft', agenda: 'ArrowDown', engine: 'ArrowDown'},
  ruler: {ruler: '', voting: 'ArrowRight', parties: 'ArrowLeft', effects: 'ArrowDown', engine: 'ArrowDown', agenda: 'ArrowDown'},
  effects: {effects: '', ruler: 'ArrowUp', parties: 'ArrowLeft', voting: 'ArrowRight', engine: 'ArrowDown', agenda: 'ArrowDown'},
  engine: {engine: '', effects: 'ArrowUp', ruler: 'ArrowUp', parties: 'ArrowUp', agenda: 'ArrowRight', voting: 'ArrowRight'},
  agenda: {agenda: '', engine: 'ArrowLeft', effects: 'ArrowLeft', voting: 'ArrowUp', ruler: 'ArrowUp', parties: 'ArrowUp'},
  parties: {parties: '', ruler: 'ArrowRight', voting: 'ArrowRight', effects: 'ArrowDown', engine: 'ArrowDown', agenda: 'ArrowDown'},
};

/**
 * Walk the browse layer's zones until `zone` is the focus zone (a positive witness on the root's own
 * attribute, the trail in the message). Every press is one step of the ring above; a walk inside a zone
 * (the bills, the opposition rows) is part of the road.
 */
export async function focusParliamentZone(page: Page, zone: ParliamentFocusZone): Promise<void> {
  const trail: Array<string> = [];
  for (let i = 0; i < 16 && await parliamentZone(page) !== zone; i++) {
    const raw = await parliamentZone(page);
    // A Parliament restored with the retired `government` zone lands on the medallion that replaced it.
    const at = (raw === 'government' ? 'ruler' : raw) as ParliamentFocusZone;
    const key = RING_STEP[at]?.[zone];
    if (key === undefined || key === '') {
      break;
    }
    trail.push(`${at} —${key}→`);
    await press(page, key, 400);
  }
  expect(await parliamentZone(page), `the ${zone} zone is the focus zone (${trail.join(' ') || 'no move'})`).toBe(zone);
}

/**
 * INSPECT THE WINNING BILL BEFORE THE SITTING (the soft gates): the verdict is a page the director turns by itself, so
 * a spec that reads the law «as voted» (its inspector's world part, its reading for the seat) reads it on the TABLE,
 * one pass before the sitting — the Parliament opened from the wheel, the cursor walked onto the bill that leads the
 * vote, X. Leaves the inspector open; `closeZoomViewer` + `enterSittingByPass` (which steps out of the Parliament)
 * continue the journey.
 */
export async function inspectWinningBill(page: Page): Promise<void> {
  await openParliament(page);
  await focusParliamentZone(page, 'voting');
  const onWinner = page.locator('.con-parl__slot--focus.con-parl__slot--winning');
  for (let i = 0; i < 6 && await onWinner.count() === 0; i++) {
    const dir = await page.evaluate(() => {
      const slots = Array.from(document.querySelectorAll('.con-parl__slot[data-instance]'));
      const at = slots.findIndex((el) => el.classList.contains('con-parl__slot--focus'));
      const to = slots.findIndex((el) => el.classList.contains('con-parl__slot--winning'));
      return to === -1 ? 'none' : (to > at ? 'ArrowRight' : 'ArrowLeft');
    });
    expect(dir, 'a bill leads the vote on the table').not.toBe('none');
    await press(page, dir, 400);
  }
  await expect(onWinner, 'the cursor stands on the bill that leads the vote').toHaveCount(1);
  await openZoomViewer(page);
}

/** The party under the cursor in the opposition column (its `data-party`), '' when the cursor stands elsewhere. */
export async function parliamentFocusedParty(page: Page): Promise<string> {
  return page.evaluate(() => document.querySelector('.con-parl__party--focus')?.getAttribute('data-party') ?? '');
}

/**
 * Walk the opposition COLUMN (▲ ▼ — «Зал» v7) onto `party`, a positive witness on every step. The ruling party
 * is not in the column (its medallion stands in the government — `focusParliamentZone(page, 'ruler')`).
 */
export async function focusParty(page: Page, party: string): Promise<void> {
  await focusParliamentZone(page, 'parties');
  for (let i = 0; i < 8 && await parliamentFocusedParty(page) !== party; i++) {
    const dir = await page.evaluate((target) => {
      const rows = Array.from(document.querySelectorAll('.con-parl__parties .con-parl__party[data-party]')).map((el) => el.getAttribute('data-party'));
      const at = rows.indexOf(document.querySelector('.con-parl__party--focus')?.getAttribute('data-party') ?? '');
      const to = rows.indexOf(target);
      return to === -1 ? 'none' : (to > at ? 'ArrowDown' : 'ArrowUp');
    }, party);
    expect(dir, `the «${party}» row stands in the opposition column`).not.toBe('none');
    await press(page, dir, 300);
  }
  expect(await parliamentFocusedParty(page), `never focused the «${party}» row`).toBe(party);
}

/**
 * Every `parliament-sitting:*` hold is released and nothing of the parliament
 * is in the air — and it has STAYED so for a beat (`quietMs`): one stage's
 * rest is often the next motion's cue (the wave lands → the field pose opens
 * for the take), so a single quiet poll can fall into the gap between two
 * consecutive holds.
 */
export async function waitSittingAtRest(page: Page, timeout = 15_000, quietMs = 250): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as {__sitQuietSince?: number}).__sitQuietSince = undefined;
  });
  await expect.poll(async () => page.evaluate((quiet) => {
    const w = window as unknown as {__conReady?: () => {holds: Array<string>}, __sitQuietSince?: number};
    const rest = (document.querySelector('.con-parl')?.getAttribute('data-sitting-motion') ?? '') === '' &&
      Array.from(document.querySelectorAll('[data-parl-flight]')).filter((el) => !(el.getAttribute('data-parl-flight') ?? '').startsWith('sit-park')).length === 0 &&
      document.querySelectorAll('.con-transfer__chip').length === 0 &&
      (w.__conReady?.().holds ?? []).every((h) => !h.startsWith('parliament-sitting') && !h.startsWith('resource-transfer'));
    if (!rest) {
      w.__sitQuietSince = undefined;
      return false;
    }
    w.__sitQuietSince = w.__sitQuietSince ?? Date.now();
    return Date.now() - w.__sitQuietSince >= quiet;
  }, quietMs), {timeout, intervals: [50]}).toBe(true);
}

/**
 * THE RESOLUTION INSPECTOR'S FOOTER (final polish A.1): two rows of members that keep their width —
 * every one inside the bar and none squeezed (a squeezed fact row cut its one-word key to «ПР»; a
 * squeezed reading spilled its caption), the plate standing inside its FIXED actions band and clear
 * of the card above it (the band is what the viewer's fit engine reserves — a plate taller than the
 * band is exactly what overlapped the card). Polled: the columns lift in after the open.
 */
export async function expectInspectorFooterWhole(page: Page, label: string): Promise<void> {
  const read = () => page.evaluate(() => {
    const out: Array<string> = [];
    const dialog = document.querySelector<HTMLElement>('dialog.con-zoom[open]');
    const bar = dialog?.querySelector<HTMLElement>('.con-zoom__bar') ?? null;
    const panel = dialog?.querySelector<HTMLElement>('.card-zoom-actions__panel') ?? null;
    const band = dialog?.querySelector<HTMLElement>('.card-zoom-actions') ?? null;
    const card = dialog?.querySelector<HTMLElement>('.card-zoom-stage .pcard') ?? null;
    if (bar === null || panel === null || band === null || card === null) {
      return 'no footer scene';
    }
    const name = (el: Element) => el.className.toString().split(' ').filter((c) => c !== '')[0] ?? el.tagName.toLowerCase();
    const box = bar.getBoundingClientRect();
    for (const kid of Array.from(bar.children) as Array<HTMLElement>) {
      const r = kid.getBoundingClientRect();
      if (r.width <= 0) {
        continue;
      }
      if (r.left < box.left - 1 || r.right > box.right + 1) {
        out.push(`${name(kid)} outside the bar (${Math.round(r.left)}..${Math.round(r.right)} of ${Math.round(box.left)}..${Math.round(box.right)})`);
      }
      if (kid.scrollWidth > kid.clientWidth + 1) {
        out.push(`${name(kid)} squeezed (${kid.scrollWidth} > ${kid.clientWidth})`);
      }
    }
    // A member's own words: a key, a plate, a caption — each whole in its own box.
    for (const el of Array.from(bar.querySelectorAll<HTMLElement>('.con-parl__fact-key, .con-iyield__reading, .con-iyield__caption'))) {
      if (el.scrollWidth > el.clientWidth + 1) {
        out.push(`${name(el)} «${(el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 24)}» cut (${el.scrollWidth} > ${el.clientWidth})`);
      }
    }
    const plate = panel.getBoundingClientRect();
    const bandBox = band.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    if (plate.height > bandBox.height + 1) {
      out.push(`plate ${Math.round(plate.height)} px tall in a ${Math.round(bandBox.height)} px band`);
    }
    if (plate.top < cardBox.bottom - 1) {
      out.push(`plate (top ${Math.round(plate.top)}) overlaps the card (bottom ${Math.round(cardBox.bottom)})`);
    }
    return out.join('; ');
  });
  await expect.poll(read, {timeout: 8_000, message: `${label}: the inspector's footer stands whole — every member inside the bar, none squeezed, the plate inside its band and clear of the card`}).toBe('');
}

/**
 * A RESOLUTION'S DOSSIER IS ITS RULES (Парламент v8, the owner's point 9): the fullscreen inspector of a resolution
 * carries the card, its party and its RULES — none of the viewer's own PLATES (the standing chip, the vote's facts,
 * the estimate, the ledger, the party's answer, the winner's tile, the grant: the vote panel's). The rules panel
 * stands and prints the PRINTED texts alone — no «ДЛЯ ВАС» block (the texts iteration 2026-10-23). Call with the
 * viewer open on a resolution.
 */
export async function expectDossierIsRules(page: Page, label = ''): Promise<void> {
  const dialog = page.locator('dialog.con-zoom[open]');
  await expect(dialog.locator('.con-zoom-rules'), `${label} the rules panel stands`.trim()).not.toHaveCount(0);
  await expect(dialog.locator('[data-zoom-yield], [data-zoom-winner], [data-zoom-reaction], [data-zoom-grant], .con-rstatus'),
    `${label} no plate of the viewer's own stands in the dossier — the vote panel carries them`.trim()).toHaveCount(0);
  const groups = await dialog.locator('.con-zoom-rules [data-rules-group]').evaluateAll((els) => els.map((el) => el.getAttribute('data-rules-group') ?? ''));
  expect(groups, `${label} no «ДЛЯ ВАС» block in a resolution's dossier — the viewer's reading is the vote panel's (${groups.join(' · ')})`.trim()).not.toContain('group:you');
}

/**
 * «ОДИН ФРЕЙМВОРК» (2026-10-24): the enacted law's standing effect is a GROUP of the effects explorer's grid, and it
 * LEADS it (decision Р1) — the badge plate (`data-efx-source="law:<id>"`, the kicker «Эффект, пока принята», the card's
 * name), the law's own printed effect on the tile, the access line. Replaces the old strip over the explorer
 * (`.con-pfx`). Returns the group, for the spec's own further reads.
 */
export async function expectLawLeadsEffects(page: Page, law: {id: string, name: RegExp}): Promise<ReturnType<Page['locator']>> {
  const group = page.locator('.con-efx__list .con-efx__group').first();
  await expect(group, 'the explorer\'s grid stands').toBeVisible({timeout: 10_000});
  const plate = group.locator('.con-efx__plate--political');
  await expect(plate, 'the LAW leads the explorer').toHaveAttribute('data-efx-source', `law:${law.id}`);
  await expect(plate.locator('.con-efx__plate-kicker'), 'said for what it is').toHaveText(/Эффект, пока принята/i);
  await expect(plate.locator('.con-efx__plate-name'), 'titled by the card').toHaveText(law.name);
  await expect(group.locator('.con-efx__tile .con-efx__graphic').first(), 'the card\'s own printed effect').toBeVisible();
  await expect(group.locator('[data-efx-access]').first(), 'WHY the seat holds it — the access line').toBeVisible();
  return group;
}
