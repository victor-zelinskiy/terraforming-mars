/*
 * CONSOLE FINAL SCORING — the shared e2e harness of the endgame journey.
 *
 * A REAL finished game (never a fixture): testMode hands every player 500 of
 * everything, so the seats can terraform Mars over the API in a few dozen
 * `player/input` round trips — the same endpoint, the same rules, the same
 * validation as the live client.
 *
 * ⚠ THE ONE LAW OF THIS HARNESS (cost a day): once the page is open, the
 * VIEWED seat's prompts are answered THROUGH THE PAGE only. `WaitingFor`
 * skips GO/REFRESH while the viewer holds a required prompt, so an API answer
 * behind a live client freezes it — a state two real clients cannot produce.
 * Drive everyone to the viewer's final-greenery question over the API, answer
 * THAT through the page (`finishFinaleThroughPage`), finish the others over
 * the API, and the promptless page hears the END through its own poll.
 *
 * ⚠ Headless Chromium starves rAF on a quiet screen — every wait here pumps
 * a tiny screenshot (a real BeginFrame), or the GSAP ceremony never advances.
 */
import * as fs from 'fs';
import * as path from 'path';
import {expect, Page, APIRequestContext} from '@playwright/test';
import {cinematicBeat, openConsole, soloGameConfig, CORP_WITH_FIRST_ACTION} from './consoleStart';
import {SPENDABLE_RESOURCES} from '../../src/common/inputs/Spendable';

export type WirePrompt = {
  type: string,
  title?: unknown,
  min?: number,
  amount?: number,
  options?: Array<WirePrompt>,
  cards?: Array<{name: string, calculatedCost?: number}>,
  spaces?: Array<string>,
  coloniesModel?: Array<{name: string}>,
  disabledColonies?: Array<{name: string, reason?: unknown}>,
  count?: number,
  include?: Array<string>,
  finalGreeneryPrompt?: unknown,
};
export type WireModel = {
  waitingFor?: WirePrompt & {finalGreeneryPrompt?: unknown},
  game: {phase: string, temperature: number, oxygenLevel: number, oceans: number, finalGreenery?: {done: Array<string>}},
  thisPlayer: {victoryPointsBreakdown?: {total: number}},
  players: Array<{color: string, name: string, victoryPointsBreakdown?: {total: number}}>,
};

// DERIVED, never a literal (the consoleStart.ts rule): `isPayment` demands a
// numeric field for EVERY entry of SPENDABLE_RESOURCES, so a hand-written map
// silently rots the day the game grows a spendable (floodgateSteel did exactly
// that — «payment is not a valid type», 400, on every drive of this harness).
export const NO_PAYMENT: Readonly<Record<string, number>> =
  Object.fromEntries(SPENDABLE_RESOURCES.map((key) => [key, 0]));

export function titleOf(prompt: WirePrompt | undefined): string {
  if (prompt === undefined) {
    return '';
  }
  return typeof prompt.title === 'string' ?
    prompt.title :
    String((prompt.title as {message?: string} | undefined)?.message ?? '');
}

export async function getModel(request: APIRequestContext, id: string): Promise<WireModel> {
  const res = await request.get(`/api/player?id=${id}`);
  expect(res.ok(), `GET api/player: ${res.status()}`).toBeTruthy();
  return res.json();
}

export async function postInput(request: APIRequestContext, id: string, response: Record<string, unknown>): Promise<WireModel> {
  const res = await request.post(`/player/input?id=${id}`, {data: response});
  expect(res.ok(), `player/input rejected ${JSON.stringify(response)}: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

/** A structural answer for any nested branch — the driver's own recursion,
 *  specialized for this journey (a branch is answered by its TYPE, never by
 *  guessing that everything nested is a bare option). */
export function genericAnswer(prompt: WirePrompt, pickCards?: ReadonlyArray<string>): Record<string, unknown> {
  switch (prompt.type) {
  case 'option':
    return {type: 'option'};
  case 'space':
    return {type: 'space', spaceId: (prompt.spaces ?? [])[0]};
  case 'card': {
    const offered = (prompt.cards ?? []).map((c) => c.name);
    const wanted = (pickCards ?? []).filter((c) => offered.includes(c));
    const take = wanted.length > 0 ? wanted : offered.slice(0, prompt.min ?? 0);
    return {type: 'card', cards: take};
  }
  case 'payment':
    return {type: 'payment', payment: {...NO_PAYMENT, megacredits: prompt.amount ?? 0}};
  case 'projectCard': {
    // A FORCED play (a first action's «play a card») — the cheapest one.
    const cheapest = [...(prompt.cards ?? [])].sort((a, b) => (a.calculatedCost ?? 0) - (b.calculatedCost ?? 0))[0];
    return {type: 'projectCard', card: cheapest?.name, payment: {...NO_PAYMENT, megacredits: cheapest?.calculatedCost ?? 0}};
  }
  case 'amount':
    return {type: 'amount', amount: prompt.min ?? 0};
  case 'colony': {
    // «Выберите колонию» arrives NESTED (a played card's effect, a standard
    // project's target step) and the journey used to die on it — the harness
    // had no answer, so the whole endgame walk failed before it began,
    // whenever the random game happened to deal a colony builder.
    // The server REFUSES a disabled colony, so answering with one would stall
    // the journey on a prompt that never moves.
    const blocked = new Set((prompt.disabledColonies ?? []).map((d) => d.name));
    const open = (prompt.coloniesModel ?? []).map((c) => c.name).filter((n) => !blocked.has(n));
    expect(open.length, `«${titleOf(prompt)}» offered no colony that is not disabled`).toBeGreaterThan(0);
    return {type: 'colony', colonyName: open[0]};
  }
  case 'and':
    return {type: 'and', responses: (prompt.options ?? []).map((o) => genericAnswer(o))};
  case 'resources': {
    // «Выберите N стандартных ресурсов» — the server validates only «non-negative and
    // the sum is exactly `count`», so putting the whole allowance on one
    // unit is the honest structural answer.
    const units = {megacredits: 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0};
    return {type: 'resources', units: {...units, megacredits: prompt.count ?? 0}};
  }
  case 'resource':
    return {type: 'resource', resource: (prompt.include ?? ['megacredits'])[0]};
  case 'or':
    return {type: 'or', index: 0, response: genericAnswer((prompt.options ?? [])[0])};
  default:
    // ⚠️ THIS IS A WORKLIST, and it fires for a reason that is not the
    // harness's fault: WHICH prompt kinds the journey meets depends on the
    // random deal, so a kind nobody has seen yet surfaces months later as
    // «the endgame walk died before it began». `colony` cost one round of
    // this, `resources` the next. Name what IS answerable so the next gap
    // is a one-line addition rather than an investigation.
    expect(false, `no generic answer for a nested «${prompt.type}» (${titleOf(prompt)}) — ` +
      'answerable kinds: option, space, card, payment, projectCard, amount, colony, ' +
      'resources, resource, and, or').toBeTruthy();
    return {type: 'option'};
  }
}

/** The terraformer strategy for ONE live prompt (undefined = nothing owed). */
export function terraformAnswer(m: WireModel): Record<string, unknown> | undefined {
  const wf = m.waitingFor;
  if (wf === undefined) {
    return undefined;
  }
  switch (wf.type) {
  case 'initialCards':
    return {
      type: 'initialCards',
      responses: (wf.options ?? []).map((step) => {
        const offered = (step.cards ?? []).map((c) => c.name);
        if (titleOf(step).startsWith('Select corporation')) {
          const calm = offered.find((c) => !CORP_WITH_FIRST_ACTION.includes(c));
          return {type: 'card', cards: [calm ?? offered[0]]};
        }
        return {type: 'card', cards: offered.slice(0, step.min ?? 0)};
      }),
    };
  case 'or': {
    const options = wf.options ?? [];
    const answerAt = (index: number, pickCards?: ReadonlyArray<string>) =>
      ({type: 'or', index, response: genericAnswer(options[index], pickCards)});
    // The FINAL GREENERY question ends the seat: the DONE branch is last.
    if (wf.finalGreeneryPrompt !== undefined) {
      return answerAt(options.length - 1);
    }
    const findByTitle = (re: RegExp) => options.findIndex((o) => re.test(titleOf(o)));
    // A corporation's owed first action gates the full menu — take it.
    const firstAction = findByTitle(/^Take first action/i);
    if (firstAction >= 0) {
      return answerAt(firstAction);
    }
    // Availability is server-authoritative: an option is answered because it
    // is PRESENT; the parameter checks only stop us re-doing a finished axis.
    if (m.game.temperature < 8) {
      const heat = findByTitle(/heat into temperature/i);
      if (heat >= 0) {
        return answerAt(heat);
      }
    }
    if (m.game.oxygenLevel < 14) {
      const plants = findByTitle(/plants into greenery/i);
      if (plants >= 0) {
        return answerAt(plants);
      }
    }
    if (m.game.oceans < 9) {
      // «Standard projects» is a PROJECT-CARD prompt (the fork's console flow
      // serves it as one) — Aquifer is bought with the card+payment shape.
      const stdIdx = options.findIndex((o) =>
        o.type === 'projectCard' && (o.cards ?? []).some((c) => c.name === 'Aquifer'));
      if (stdIdx >= 0) {
        const aquifer = (options[stdIdx].cards ?? []).find((c) => c.name === 'Aquifer');
        return {
          type: 'or', index: stdIdx,
          response: {
            type: 'projectCard', card: 'Aquifer',
            payment: {...NO_PAYMENT, megacredits: aquifer?.calculatedCost ?? 18},
          },
        };
      }
    }
    const pass = findByTitle(/^Pass/i);
    if (pass >= 0) {
      return answerAt(pass);
    }
    // No pass branch: a corp's owed side question with no way around it
    // (e.g. «Pay 2 M€ to draw a card | Do not buy a card»). The DECLINING
    // branch is conventionally last — take it and keep terraforming.
    expect(options.length, 'an empty OR cannot be answered').toBeGreaterThan(0);
    return answerAt(options.length - 1);
  }
  default:
    return genericAnswer(wf);
  }
}

/**
 * Drive every seat with the terraformer until `stop` says so.
 * Returns the last model of the FIRST seat.
 */
export async function drive(
  request: APIRequestContext,
  ids: ReadonlyArray<string>,
  stop: (m: WireModel) => boolean,
  maxRounds = 500,
): Promise<WireModel> {
  let idle = 0;
  for (let round = 0; round < maxRounds; round++) {
    if (round % 20 === 0) {
      const m0 = await getModel(request, ids[0]);
      console.log(`[drive] round ${round} phase=${m0.game.phase} temp=${m0.game.temperature} oxy=${m0.game.oxygenLevel} oceans=${m0.game.oceans}`);
    }
    let answered = false;
    for (const id of ids) {
      // `player/input` replies with the UPDATED model — a seat plays its whole
      // turn chain in one streak, no re-GET between the steps.
      let m = await getModel(request, id);
      for (let streak = 0; streak < 30; streak++) {
        if (stop(m)) {
          return m;
        }
        const answer = terraformAnswer(m);
        if (answer === undefined) {
          break;
        }
        m = await postInput(request, id, answer);
        answered = true;
      }
    }
    if (!answered && ++idle > 40) {
      const m = await getModel(request, ids[0]);
      expect(false, `the table stalled (phase ${m.game.phase}, waiting ${m.waitingFor?.type ?? 'nobody'})`).toBeTruthy();
    } else if (answered) {
      idle = 0;
    } else {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  expect(false, `never reached the stop condition in ${maxRounds} rounds`).toBeTruthy();
  throw new Error('unreachable');
}

/**
 * PHASE-4 FIXTURE TABLE — the 2p pre-endgame state as a fixture instead of a
 * played-out game: temperature + oceans maxed, oxygen ONE step short, the
 * viewed seat holding the plants. `journeyToEndgame`'s drive() converges from
 * here in a few raises; the specs' own subject (the finale through the page,
 * the ceremony, the overview) is untouched. Regenerate: `npm run e2e:fixtures`.
 */
export async function fixtureTable(request: APIRequestContext, name = 'two-player-pre-endgame'): Promise<Array<string>> {
  const file = path.resolve(__dirname, 'fixtures', `${name}.json`);
  const serialized = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  const res = await request.post('/api/dev/load-game', {data: serialized});
  expect(res.ok(), `dev load-game accepted the endgame fixture (status ${res.status()})`).toBeTruthy();
  const body = await res.json() as {players: Array<{id: string}>};
  return body.players.map((p) => p.id);
}

export async function createTable(
  request: APIRequestContext,
  colors: ReadonlyArray<string>,
  expansions: Record<string, boolean> = {},
): Promise<Array<string>> {
  const config = soloGameConfig({
    players: colors.map((color, i) => ({
      name: i === 0 ? 'Оч-Длинное-Имя-Игрока-' + color : 'Игрок-' + color,
      color, beginner: false, handicap: 0, first: i === 0,
    })),
    // testMode deals 8 corporations PER SEAT — base+corpEra hold only 24, so a
    // four-seat table needs the wider corp pool or two seats are never dealt
    // and the start deadlocks on `every(pickedCorporationCard)`.
    expansions,
  });
  const created = await request.post('/api/creategame', {data: config});
  expect(created.ok(), `creategame: ${created.status()}`).toBeTruthy();
  const body = await created.json();
  return body.players.map((p: {id: string}) => p.id);
}

export const terraformed = (m: WireModel) =>
  m.game.temperature >= 8 && m.game.oxygenLevel >= 14 && m.game.oceans >= 9;

/** A tiny screenshot IS a BeginFrame — the rAF pump for headless Chromium. */
export async function forceFrame(page: Page): Promise<void> {
  await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => {});
}

export async function waitWithFrames(page: Page, predicate: () => Promise<boolean>, maxMs: number, what: string): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (await predicate()) {
      return;
    }
    await forceFrame(page);
    await page.waitForTimeout(120);
  }
  expect(false, `timed out waiting for ${what}`).toBeTruthy();
}

export async function shoot(page: Page, dir: string, name: string): Promise<void> {
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: `${dir}/${name}.png`});
}

/** A STORYBOARD of one scene (`TM_E2E_STORYBOARD=1` only): every frame the compositor produced, named by its time. */
export async function storyboard(page: Page, dir: string, name: string): Promise<() => Promise<void>> {
  if (process.env.TM_E2E_STORYBOARD !== '1') {
    return async () => {};
  }
  const out = path.join(dir, `story-${name}`);
  fs.rmSync(out, {recursive: true, force: true});
  fs.mkdirSync(out, {recursive: true});
  const client = await page.context().newCDPSession(page);
  const t0 = Date.now();
  client.on('Page.screencastFrame', (frame) => {
    fs.writeFileSync(path.join(out, `t${String(Date.now() - t0).padStart(5, '0')}.jpg`), Buffer.from(frame.data, 'base64'));
    void client.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await client.send('Page.startScreencast', {format: 'jpeg', quality: 82, everyNthFrame: 1});
  return async () => {
    await client.send('Page.stopScreencast').catch(() => undefined);
  };
}

/**
 * The finale's own block in the cell dossier — present for the SESSION's whole life (PL-303 / PL-304): the pick,
 * the landing, another seat's answer. Its `data-finale-stage` says where the context stands.
 */
export const FINALE_BLOCK = '[data-finale-bank]';

/** The finale context's stage as the dossier states it (`pick` / `landing` / `wait`), or undefined when it is gone. */
export async function finaleStage(page: Page): Promise<string | undefined> {
  return page.evaluate((sel) => (document.querySelector(sel) as HTMLElement | null)?.dataset.finaleStage, FINALE_BLOCK);
}

/**
 * THE CONTEXT WITNESS (PL-303): an in-page observer armed across a landing or a hand-off that records what the
 * owner saw on the TV — the dossier re-mounting, a plate or a task band rising over the board, the planet focus
 * letting go, the dossier's leave transition. Every count must be zero for the context to be ONE.
 */
export async function armFinaleWitness(page: Page): Promise<void> {
  await page.evaluate((sel) => {
    const w = (window as unknown as {__finaleWitness?: Record<string, unknown>});
    const panel = document.querySelector(sel)?.closest('.con-context') ?? null;
    const state = {
      panelAtStart: panel,
      panelRemounts: 0,
      plateSeen: 0,
      hostSeen: 0,
      focusExits: 0,
      panelLeaves: 0,
      stages: [] as Array<string>,
      lastStage: (document.querySelector(sel) as HTMLElement | null)?.dataset.finaleStage ?? '',
    };
    const board = document.querySelector('.con-board');
    const observer = new MutationObserver(() => {
      const now = document.querySelector(sel)?.closest('.con-context') ?? null;
      if (now !== null && state.panelAtStart !== null && now !== state.panelAtStart) {
        state.panelRemounts += 1;
        state.panelAtStart = now;
      }
      if (document.querySelector('.con-mandatory') !== null) {
        state.plateSeen += 1;
      }
      if (document.querySelector('.con-task-host') !== null) {
        state.hostSeen += 1;
      }
      if (board?.classList.contains('con-board--pfocus-exit')) {
        state.focusExits += 1;
      }
      if (document.querySelector('.con-context.con-ctx-leave-active') !== null) {
        state.panelLeaves += 1;
      }
      const stage = (document.querySelector(sel) as HTMLElement | null)?.dataset.finaleStage ?? '';
      if (stage !== state.lastStage) {
        state.lastStage = stage;
        state.stages.push(stage === '' ? 'gone' : stage);
      }
    });
    observer.observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'data-finale-stage']});
    w.__finaleWitness = {state, observer};
  }, FINALE_BLOCK);
}

export type FinaleWitness = {panelRemounts: number, plateSeen: number, hostSeen: number, focusExits: number, panelLeaves: number, stages: Array<string>};

export async function readFinaleWitness(page: Page): Promise<FinaleWitness> {
  return page.evaluate(() => {
    const w = (window as unknown as {__finaleWitness?: {state: FinaleWitness & {panelAtStart: unknown, lastStage: string}, observer: MutationObserver}});
    const s = w.__finaleWitness?.state;
    if (s === undefined) {
      return {panelRemounts: -1, plateSeen: -1, hostSeen: -1, focusExits: -1, panelLeaves: -1, stages: []};
    }
    return {panelRemounts: s.panelRemounts, plateSeen: s.plateSeen, hostSeen: s.hostSeen, focusExits: s.focusExits, panelLeaves: s.panelLeaves, stages: [...s.stages]};
  });
}

export async function disarmFinaleWitness(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = (window as unknown as {__finaleWitness?: {observer: MutationObserver}});
    w.__finaleWitness?.observer.disconnect();
    delete w.__finaleWitness;
  });
}

/**
 * THE PRICE PROBE (PL-306 — a greenery bought with plants): armed beside the transfer witness (same moment, same
 * `performance.now()` clock to within a millisecond), it records the plants row's digits as the player reads them,
 * the hero's own account of the price beat (`data-tile-price`) and the FIRST painted frame of the own tile proxy
 * (where the tile is born — the sprout grows out of its cell, never from the table). A 16 ms sampler + a
 * MutationObserver, never rAF.
 */
export type PriceProbe = {
  rows: Array<[number, string]>;
  /** The plants row's own ±N delta chip, as painted (text, '' when none). */
  chips: Array<[number, string]>;
  price: Array<[number, string]>;
  tileFirst: {t: number, cx: number, cy: number, w: number} | undefined;
};

export async function armPriceProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    type Probe = {rows: Array<[number, string]>, chips: Array<[number, string]>, price: Array<[number, string]>, tileFirst: {t: number, cx: number, cy: number, w: number} | undefined};
    const w = window as unknown as {__priceProbe?: {probe: Probe, stop: () => void}};
    w.__priceProbe?.stop();
    const probe: Probe = {rows: [], chips: [], price: [], tileFirst: undefined};
    const t0 = performance.now();
    const opacityOf = (el: Element): number => {
      let op = 1;
      for (let n: Element | null = el; n !== null; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          return 0;
        }
        op *= Number(cs.opacity);
      }
      return op;
    };
    const sample = () => {
      const t = Math.round(performance.now() - t0);
      const digits = document.querySelector('.con-res__row--plants .con-res__digits');
      const text = (digits?.firstChild?.textContent ?? '').trim();
      if (probe.rows[probe.rows.length - 1]?.[1] !== text) {
        probe.rows.push([t, text]);
      }
      const chip = (document.querySelector('.con-res__row--plants .con-res__digits .metric-feedback-host')?.textContent ?? '').replace(/\s+/g, '');
      if (probe.chips[probe.chips.length - 1]?.[1] !== chip) {
        probe.chips.push([t, chip]);
      }
      const account = document.querySelector('.con-tileplace')?.getAttribute('data-tile-price') ?? '';
      if (probe.price[probe.price.length - 1]?.[1] !== account) {
        probe.price.push([t, account]);
      }
      if (probe.tileFirst === undefined) {
        const tile = document.querySelector('.con-tileplace__tile:not(.con-tileplace__tile--depart):not(.con-tileplace__tile--cover):not(.con-tileplace__tile--remote)');
        if (tile !== null && opacityOf(tile) > 0.05) {
          const r = tile.getBoundingClientRect();
          if (r.width > 2) {
            probe.tileFirst = {t, cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width};
          }
        }
      }
    };
    const timer = window.setInterval(sample, 16);
    const mo = new MutationObserver(sample);
    mo.observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
    sample();
    w.__priceProbe = {probe, stop: () => {
      window.clearInterval(timer);
      mo.disconnect();
    }};
  });
}

export async function readPriceProbe(page: Page): Promise<PriceProbe> {
  return page.evaluate(() => {
    const w = window as unknown as {__priceProbe?: {probe: PriceProbe, stop: () => void}};
    w.__priceProbe?.stop();
    const p = w.__priceProbe?.probe;
    return {rows: [...(p?.rows ?? [])], chips: [...(p?.chips ?? [])], price: [...(p?.price ?? [])], tileFirst: p?.tileFirst};
  });
}

/**
 * PLACE ONE FINAL GREENERY through the page: lock, confirm past the dwell, judged by the SERVER's stock dropping —
 * never by the dossier leaving (inside the session it never does). An illegal cell under the cursor walks one
 * step and retries, like `placeTile`.
 */
export async function placeFinaleGreenery(page: Page, request: APIRequestContext, viewerId: string, maxTries = 24): Promise<boolean> {
  const stockOf = async () => (await getModel(request, viewerId) as unknown as {thisPlayer: {plants: number}}).thisPlayer.plants;
  const before = await stockOf();
  const dirs = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowUp'];
  for (let i = 0; i < maxTries; i++) {
    await page.keyboard.press('Enter'); // lock
    await cinematicBeat(page, 420, 'the two-phase pick: the confirm must land PAST the 280 ms lock dwell');
    await page.keyboard.press('Enter'); // confirm
    for (let waited = 0; waited < 6_000; waited += 150) {
      if (await stockOf() < before) {
        return true;
      }
      await forceFrame(page);
      await cinematicBeat(page, 150, "the server's answer is on the wire — the stock is the witness");
    }
    await page.keyboard.press(dirs[i % dirs.length]);
    await cinematicBeat(page, 300, 'the cursor step lands before the next lock');
  }
  return (await stockOf()) < before;
}

/**
 * Wait until the viewer's FINALE stands on the board: take pending reveals,
 * open past the announce (A), until the board is in placement with the
 * finale's block in the dossier (the final greenery is played ON THE BOARD —
 * 2026-10-14; there is no finale dialog any more).
 */
export async function openFinaleOnBoard(page: Page): Promise<void> {
  await waitWithFrames(page, async () => {
    if ((await page.locator('.con-reveal').count()) > 0) {
      await page.keyboard.press('Enter'); // take the pending drawn cards first
      return false;
    }
    if ((await page.locator('.con-mandatory').count()) > 0) {
      await page.keyboard.press('Enter'); // the announce hands the board over
      return false;
    }
    return (await page.locator(FINALE_BLOCK).count()) > 0;
  }, 45_000, 'the final greenery on the board (the finale block in the dossier)');
}

/**
 * «Завершить свою партию» — the irreversible stop is a HOLD of RT (the shared
 * hold-to-confirm, the «Пас» gesture): keyboard Period down past the hold,
 * then up. A tap does nothing by design.
 */
export async function holdFinishFinale(page: Page): Promise<void> {
  await page.keyboard.down('Period');
  for (let i = 0; i < 8; i++) {
    await forceFrame(page);
    await cinematicBeat(page, 140, 'the RT hold ring fills on the wall clock (HOLD_CONFIRM_MS) — the press must stay DOWN that long');
  }
  await page.keyboard.up('Period');
}

/**
 * The VIEWED seat answers its own final-greenery question THROUGH THE PAGE —
 * open the finale on the board, then HOLD the finish (the couch player's own
 * gesture). Places nothing: the journeys that use it are about the endgame,
 * not the conversion.
 */
export async function finishFinaleThroughPage(page: Page): Promise<void> {
  await openFinaleOnBoard(page);
  await holdFinishFinale(page);
  await waitWithFrames(page, async () => (await page.locator(FINALE_BLOCK).count()) === 0, 20_000, 'the finale finish');
}

/**
 * Bring a fresh table all the way to Phase.END with the FIRST seat viewed on
 * the page: terraform over the API, answer the viewer's finale through the
 * page, finish the rest over the API, then wait out pending reveals until the
 * endgame workspace stands.
 */
export async function journeyToEndgame(
  page: Page,
  request: APIRequestContext,
  ids: ReadonlyArray<string>,
): Promise<void> {
  await drive(request, ids, terraformed);
  await drive(request, ids, (m) => m.waitingFor?.finalGreeneryPrompt !== undefined && m.game.phase !== 'end');
  await openConsole(page, ids[0]);
  await finishFinaleThroughPage(page);
  await drive(request, ids, (m) => m.game.phase === 'end');
  await waitWithFrames(page, async () => {
    if ((await page.locator('.con-reveal').count()) > 0) {
      await page.keyboard.press('Enter');
      return false;
    }
    return (await page.locator('.con-endgame').count()) > 0;
  }, 75_000, 'the endgame workspace (taking pending reveals first)');
}
