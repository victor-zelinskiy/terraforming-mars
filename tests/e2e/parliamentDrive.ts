import {expect, Page, APIRequestContext} from './consoleTest';
import {fetchPlayerModel, pressUntil, sendPlayerInput} from './consoleStart';

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
    parliamentPhasePrompt?: {stage: string; awaiting: Array<string>};
  };
  game: {
    phase: string; generation: number;
    parliament?: {phase?: {step: string; awaiting?: Array<string>; pending?: {player: string}; outcomes?: Array<Record<string, unknown>>;
      summary?: {agenda?: {player: string; from: number; to: number; bonus?: string}; winner: {player?: string}; refreshed: Array<unknown>}}};
  };
  thisPlayer: {color: string; cardsInHandNbr: number; terraformRating: number; plants: number; heatProduction: number; megaCreditProduction: number};
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

/** The reward stage's step for this seat (`reading` · `choice` · `intake` · `placement` · `waiting` · `received` · `gate`). */
export async function sittingStep(page: Page): Promise<string> {
  return (await page.locator('.con-sit').getAttribute('data-sit-step')) ?? '';
}

/** The command bar's HOT verb (the sitting's A), by its label. */
export async function hotVerb(page: Page): Promise<string> {
  const labels = await page.locator('.con-cmdbar__cmd--hot .con-cmdbar__label').allTextContents();
  return labels.map((l) => l.trim()).join(' | ');
}

/** Turn the sitting's page by A until `stage` is on screen (a positive, specific witness). */
export async function turnTo(page: Page, stage: string): Promise<boolean> {
  return pressUntil(page, 'Enter', async () => await sittingStage(page) === stage, {tries: 4, settleMs: 1100});
}

/** Answer a standing PARLIAMENT GATE for `seat` over the API (the other seat of a two-seat fixture). */
export async function answerGateAs(request: APIRequestContext, seat: string, stage: 'assembly' | 'adjourn'): Promise<void> {
  const wire = await parliamentWire(request, seat);
  expect(wire.waitingFor?.parliamentPhasePrompt?.stage, `${seat} stands at the ${stage} gate`).toBe(stage);
  await sendPlayerInput(request, seat, {type: 'option', promptId: wire.waitingFor?.promptId} as never);
}

/** Answer `seat`'s standing resolution asks over the API with the plainest legal answer until none stands (a card take: every card; a pick: the first). */
export async function answerAsksAs(request: APIRequestContext, seat: string, rounds = 6): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    const wire = await parliamentWire(request, seat);
    const wf = wire.waitingFor;
    if (wf === undefined || wf.parliamentPhasePrompt !== undefined || wf.type !== 'card') {
      return;
    }
    await sendPlayerInput(request, seat, {type: 'card', cards: (wf.cards ?? []).map((c) => c.name).slice(0, 1), promptId: wf.promptId} as never);
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
export async function expectParliamentFits(page: Page, label: string): Promise<void> {
  const problems = await page.evaluate(() => {
    const root = document.querySelector('.con-parl');
    if (root === null) {
      return ['no root'];
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const out: Array<string> = [];
    const name = (el: Element) => el.className.toString().split(' ')[0];
    const blocks = '.con-parl__gov, .con-parl__slot, .con-parl__stage, .con-sit__panel--on, .con-sit__row, .con-sit__closing,' +
      ' .con-iyield, .con-iyield__reading, .con-preact, .con-wreward, .con-sit__skip, .con-sit__zone--on, .con-extdraw__cards, .con-cards__slot, .con-task,' +
      ' .con-cards__verdictbar, .con-sit__wait, .con-sit__awaiting';
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(blocks))) {
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
    }
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
      const cs = getComputedStyle(el);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll' || cs.overflowX === 'auto' || cs.overflowX === 'scroll') &&
          (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) {
        out.push(`scroll-container ${name(el)} ${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight}`);
      }
    }
    return out;
  });
  expect(problems, `${label}: layout problems`).toEqual([]);
}

/** The leak detector's own verdict: no stranded prompt was ever reported on this page. */
export async function armLeakWitness(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__stranded: Array<string>};
    w.__stranded = [];
    const orig = console.warn.bind(console);
    console.warn = (...args: Array<unknown>) => {
      const text = args.map(String).join(' ');
      if (text.includes('STRANDED PROMPT')) {
        w.__stranded.push(text);
      }
      orig(...args);
    };
  });
}

export async function strandedReports(page: Page): Promise<Array<string>> {
  return page.evaluate(() => (window as unknown as {__stranded?: Array<string>}).__stranded ?? []);
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
    const rest = (document.querySelector('.con-parl__stage')?.getAttribute('data-sitting-motion') ?? '') === '' &&
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
