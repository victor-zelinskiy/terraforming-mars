import {expect, Page, APIRequestContext} from './consoleTest';
import {fetchPlayerModel, openQuickWheel, press, pressUntil, sendPlayerInput, settle} from './consoleStart';

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
      summary?: {
        agenda?: {player: string; from: number; to: number; bonus?: string}; winner: {player?: string; instance?: string}; refreshed: Array<unknown>;
        support?: Array<{party: string; gained: number; total: number}>;
      }}};
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

/** The sitting's stages in walk order (v2); the retired «renewal» / «closing» pages are the RESULTS stage. */
const SITTING_STAGE_ORDER = ['verdict', 'enact', 'reward', 'results'];
const RETIRED_SITTING_STAGES: Record<string, string> = {renewal: 'results', closing: 'results'};

/**
 * Bring the sitting to `stage` («Заседание v2»): the enactment and the reward turn BY THEMSELVES — A answers
 * only the verdict (gate 1) and the results (gate 2). On the verdict A is pressed once, with a positive witness
 * (the stage left the verdict, or the verdict shows its wait pose — the other seats have not answered yet);
 * then the walk is awaited until it has reached — or passed — `stage`. False when it never gets there: a
 * spec that needs the enactment must first let the OTHER seats answer gate 1 (`answerGateAs`).
 */
export async function turnTo(page: Page, stage: string, timeout = 60_000): Promise<boolean> {
  const target = RETIRED_SITTING_STAGES[stage] ?? stage;
  const rank = (s: string) => SITTING_STAGE_ORDER.indexOf(s);
  const reached = async () => rank(await sittingStage(page)) >= rank(target);
  if (await reached()) {
    return true;
  }
  const waiting = () => page.locator('.con-sit__panel--on [data-sit-awaiting]').count();
  if (await sittingStage(page) === 'verdict' && await waiting() === 0) {
    const pressed = await pressUntil(page, 'Enter', async () => await sittingStage(page) !== 'verdict' || await waiting() > 0, {tries: 4, settleMs: 1100});
    if (!pressed) {
      return false;
    }
  }
  try {
    await expect.poll(reached, {timeout}).toBe(true);
    return true;
  } catch {
    return false;
  }
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
      ' .con-iyield, .con-iyield__reading, .con-preact, .con-wreward, .con-sit__skip, .con-sit__zone--on, .con-extdraw__cards, .con-cards__slot, .con-task,' +
      ' .con-cards__verdictbar, .con-sit__wait, .con-sit__awaiting,' +
      // The other parliament chassis a gallery photographs: the announce plate, the fullscreen inspect, the party composer, the playground, the seat.
      ' .con-mandatory__card, .con-mandatory__body, .con-zoom__card, .con-zoom__aside, .con-zoom__foot, .con-pact__panel, .con-pact__step, .con-rplay__panel, .con-seat__panel';
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
      // A POSE OF THE SITTING IS A FIXED TIER: the stage's box is the middle tier's (`--con-parl-mid-h`), and a
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

/** Open the Parliament workspace from the quick wheel (RT → down): the direction press IS the activation. */
export async function openParliament(page: Page): Promise<void> {
  for (let i = 0; i < 6 && await parliament(page).count() === 0; i++) {
    await openQuickWheel(page);
    await press(page, 'ArrowDown', 1400);
  }
  await expect(parliament(page)).toHaveCount(1, {timeout: 15_000});
  await settle(page, {timeoutMs: 15_000});
}

/** The browse layer's focus ZONE (`data-zone` on the root): government · voting · parties. */
export async function parliamentZone(page: Page): Promise<string> {
  return (await parliament(page).getAttribute('data-zone')) ?? '';
}

/**
 * Walk the browse layer's zones until `zone` is the focus zone (a positive witness on the root's own
 * attribute). v2: four zones on the top row — government · ruler · voting (left to right) — and the
 * opposition row below.
 */
export async function focusParliamentZone(page: Page, zone: 'ruler' | 'voting' | 'parties'): Promise<void> {
  // v3 В5: THREE zones — the ruler's tile is the government's only stop, the enacted resolution rides R3.
  const order = ['ruler', 'voting'];
  for (let i = 0; i < 8 && await parliamentZone(page) !== zone; i++) {
    const at = await parliamentZone(page);
    let key: string;
    if (zone === 'parties') {
      key = 'ArrowDown';
    } else if (at === 'parties') {
      key = 'ArrowUp';
    } else {
      key = order.indexOf(zone) > order.indexOf(at) ? 'ArrowRight' : 'ArrowLeft';
    }
    await press(page, key, 400);
  }
  expect(await parliamentZone(page), `the ${zone} zone is the focus zone`).toBe(zone);
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
