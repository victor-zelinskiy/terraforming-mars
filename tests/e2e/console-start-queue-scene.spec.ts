import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  createGameWithCards, fetchPlayerModel, fillPicks, focusCard, openConsole, pickCards, playQueueCard, press, sendPlayerInput,
  settle, soloGameConfig, submitSummary, waitQueueIdle, walkToSummary,
} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness} from './witness';

/**
 * THE WITNESS OF «СТАРТ ПАРТИИ › ПРОЛОГИ › РОЗЫГРЫШ» — THE DEPLOYMENT AT ONE GLANCE (TRP0 · DE, 2026-10-31). The first
 * screen of every game, three profiles, the real UI start:
 *   (а) a queue card takes over 55 % of the queue's height (the deck: 45 %) — the size is solved from the box;
 *   (б) under every corporation / prelude ONE reading line with its verdict — never a fact of the face;
 *   (в) a d-pad walk moves no reading line and no shelf box (±1 px);
 *   (г) the focused card is the hero — larger than its neighbour;
 *   (д) the shelf has no dashed placeholder and no «0»;
 *   (е) every card and its line stand inside the scene (nothing clipped);
 *   (ж) the played Prelude lands in the very socket that stood there before.
 * Scenarios: two preludes (+ the corporation) → one; a WAITING prelude beside its enabler; two preludes + bought
 * projects. «До» this polish (a), (б) and (д) were red: the cards stood at a fixed 0.62 × uiScale (≈ 27 % of the band),
 * no line stood under a card, the empty shelf place was a dashed box.
 */

type Preset = {id: string, viewport: {width: number, height: number}, query: string, floor: number};
const PRESETS: ReadonlyArray<Preset> = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto', floor: 0.55},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv', floor: 0.55},
  {id: 'deck', viewport: {width: 1280, height: 800}, query: '', floor: 0.45},
];
const OUT = path.resolve('screenshots', 'p47', process.env.TM_E2E_SHOTS_TAG ?? '');
const CORP = 'Teractor';

type Rect = {x: number, y: number, w: number, h: number};

async function shoot(page: Page, preset: Preset, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, preset.id), {recursive: true});
  await page.screenshot({path: path.join(OUT, preset.id, `${name}.png`)});
}

/** Boot the real start with `preludes` picked (and `buy` projects bought), the corporation left in the queue. */
async function bootDeployment(page: Page, request: APIRequestContext, preset: Preset, preludes: [string, string], deal: Array<string>, buy = 0): Promise<string> {
  const playerId = await createGameWithCards(request, [], {config: soloGameConfig({
    expansions: {prelude: true, promo: true},
    startingCorporations: 1,
    customCorporationsList: [CORP],
    customPreludes: deal,
  })});
  await openConsole(page, playerId, preset.query);
  await walkToSummary(page, {
    onStep: async (p, kind) => {
      if (kind === 'corporation') {
        expect(await pickCards(p, [CORP]), 'the corporation was picked').toContain(CORP);
      } else if (kind === 'prelude') {
        expect(await pickCards(p, preludes), 'both preludes were picked').toEqual(expect.arrayContaining(preludes));
      } else if (kind === 'project' && buy > 0) {
        // Every pick verified on the step's own slots (act → verify), never a blind «A, →» series.
        await fillPicks(p, buy);
      }
    },
  });
  await submitSummary(page);
  await page.locator('.con-start--ceremony').waitFor({timeout: 90_000});
  await waitQueueIdle(page);
  await settle(page, {timeoutMs: 30_000});
  return playerId;
}

/** The scene's geometry as the witness reads it. */
const sceneRead = (page: Page) => page.evaluate(() => {
  const rect = (el: Element | null): {x: number, y: number, w: number, h: number} | undefined => {
    if (el === null) {
      return undefined;
    }
    const r = el.getBoundingClientRect();
    return {x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height)};
  };
  const queue = document.querySelector('.con-start__queue');
  const ceremony = document.querySelector('.con-start__ceremony');
  const cards = Array.from(document.querySelectorAll('.con-start__qcard')).map((el) => ({
    name: el.getAttribute('data-queue-slot') ?? '',
    focused: el.classList.contains('con-start__qcard--focused'),
    rect: rect(el)!,
    reading: el.querySelector('[data-qcard-reading]') === null ? undefined : {
      rect: rect(el.querySelector('[data-qcard-reading]'))!,
      verdict: el.querySelector('[data-qcard-reading]')?.getAttribute('data-qcard-verdict') ?? '',
      text: (el.querySelector('[data-qcard-reading] .con-start__qread-verdict')?.textContent ?? '').trim(),
      tags: el.querySelectorAll('[data-qcard-reading] .resource-tag, [data-qcard-reading] .card-tag').length,
    },
  }));
  const shelf = Array.from(document.querySelectorAll('.con-splayed__top')).map((el) => rect(el)!);
  const rings = Array.from(document.querySelectorAll('.con-splayed__place-ring')).map((el) => getComputedStyle(el).borderTopStyle);
  const caps = Array.from(document.querySelectorAll('.con-splayed__cap')).map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim());
  return {queue: rect(queue), ceremony: rect(ceremony), cards, shelf, rings, caps};
});

/**
 * THE SCENE AT REST (FLAKE ZERO, class C): `settle`, then the same scene twice in a row a frame apart — a box read once
 * is wherever the machine had got to (the hero's scale, a landing in its socket), and the witness COMPARES scenes, so
 * every side of a comparison comes through here.
 */
async function settledScene(page: Page, what: string): Promise<Awaited<ReturnType<typeof sceneRead>>> {
  return readSettled(page, () => sceneRead(page), {message: what});
}

/** What a d-pad walk must never move (в), read IN THE PAGE for the walk's witness: every card's reading line (null when
 *  the card wears none) and every shelf box. */
type StillParts = {lines: Record<string, Rect | null>, shelf: Array<Rect>};

const near = (a: Rect, b: Rect) => Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1 && Math.abs(a.w - b.w) <= 1 && Math.abs(a.h - b.h) <= 1;

/** (а) (б) (г) (д) (е) on the scene as it stands. */
async function judge(page: Page, preset: Preset, label: string): Promise<void> {
  const s = await settledScene(page, label);
  expect(s.queue, `${label}: the queue stands`).toBeDefined();
  const queueH = s.queue!.h;
  const rest = s.cards.filter((c) => !c.focused);
  const resting = (rest.length > 0 ? rest : s.cards).map((c) => c.rect.h);
  const share = Math.min(...resting) / queueH;
  console.log(`[queue-scene] ${preset.id} · ${label}: card ${Math.min(...resting)} px of the queue's ${queueH} px = ${Math.round(share * 100)} %`);
  expect(share, `${label} (а): a queue card is ${Math.round(share * 100)} % of the queue's ${queueH} px`).toBeGreaterThanOrEqual(preset.floor);
  for (const c of s.cards) {
    expect(c.reading, `${label} (б): ${c.name} wears its reading line`).toBeDefined();
    expect(c.reading!.tags, `${label} (б): ${c.name}'s line repeats no tag of the face`).toBe(0);
    expect(c.reading!.text.includes('M€'), `${label} (б): ${c.name}'s line prints no price`).toBe(false);
    // (е) — the card and its line stand inside the scene.
    const box = s.ceremony!;
    for (const r of [c.rect, c.reading!.rect]) {
      expect(r.x >= box.x - 1 && r.y >= box.y - 1 && r.x + r.w <= box.x + box.w + 1 && r.y + r.h <= box.y + box.h + 1,
        `${label} (е): ${c.name} ${JSON.stringify(r)} inside ${JSON.stringify(box)}`).toBe(true);
    }
  }
  const focused = s.cards.find((c) => c.focused);
  const other = s.cards.find((c) => !c.focused && c.name !== CORP);
  if (focused !== undefined && other !== undefined) {
    expect(focused.rect.h, `${label} (г): the focused card is the hero`).toBeGreaterThan(other.rect.h);
  }
  expect(s.rings.filter((r) => r === 'dashed'), `${label} (д): no dashed placeholder on the shelf`).toEqual([]);
  expect(s.caps.filter((c) => /\b0$/.test(c)), `${label} (д): no «0» on the shelf`).toEqual([]);
}

/**
 * (в) — a d-pad walk moves only the cards' kant and scale: every line and every shelf box stands still.
 *
 * MID-WALK is a claim about the frames of the walk, so the parts are RECORDED from before the press (`armWitness`,
 * `settled` — the state a task leaves, the one a frame can paint), never sampled once a beat after it, which read
 * wherever the machine had got to; the walk's end is judged again at rest.
 */
async function walkKeepsStill(page: Page, label: string): Promise<void> {
  const before = await settledScene(page, `${label}: before the walk`);
  const lineBefore = (name: string) => before.cards.find((b) => b.name === name)?.reading?.rect;
  const judgeStill = (s: StillParts, key: string, when: string) => {
    for (const [name, line] of Object.entries(s.lines)) {
      const was = lineBefore(name);
      expect(was !== undefined && line !== null && near(was, line),
        `${label} (в): ${name}'s line moved ${JSON.stringify(was)} → ${JSON.stringify(line)} on ${key} (${when})`).toBe(true);
    }
    s.shelf.forEach((r, i) => expect(near(before.shelf[i], r), `${label} (в): shelf box ${i} moved on ${key} (${when})`).toBe(true));
  };
  for (const key of ['ArrowRight', 'ArrowLeft']) {
    const walk = await armWitness<StillParts>(page, 'queue-walk-still', () => {
      const rect = (el: Element) => {
        const r = el.getBoundingClientRect();
        return {x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height)};
      };
      const lines: Record<string, {x: number, y: number, w: number, h: number} | null> = {};
      for (const card of Array.from(document.querySelectorAll('.con-start__qcard'))) {
        const line = card.querySelector('[data-qcard-reading]');
        lines[card.getAttribute('data-queue-slot') ?? ''] = line === null ? null : rect(line);
      }
      return {lines, shelf: Array.from(document.querySelectorAll('.con-splayed__top')).map(rect)};
    }, {settled: true});
    await press(page, key, 150);
    const after = await settledScene(page, `${label}: after ${key}`);
    for (const s of await walk.stop().then((samples) => samples.map((x) => x.v))) {
      judgeStill(s, key, 'mid-walk');
    }
    judgeStill({
      lines: Object.fromEntries(after.cards.map((c) => [c.name, c.reading?.rect ?? null])),
      shelf: after.shelf,
    }, key, 'at rest');
  }
}

async function playCorporation(page: Page, request: APIRequestContext, playerId: string): Promise<void> {
  expect(await playQueueCard(page, CORP), 'the corporation was played').toBe(true);
  for (let i = 0; i < 20; i++) {
    const wire = await fetchPlayerModel(request, playerId) as unknown as {thisPlayer: {tableau: Array<{name: string}>}, waitingFor?: {type?: string, coloniesModel?: Array<{name: string}>}};
    if (wire.waitingFor?.type === 'colony') {
      await sendPlayerInput(request, playerId, {type: 'colony', colonyName: (wire.waitingFor.coloniesModel ?? [])[0]?.name ?? ''});
      break;
    }
    if (wire.thisPlayer.tableau.some((c) => c.name === CORP)) {
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  await waitQueueIdle(page);
  await settle(page, {timeoutMs: 30_000});
}

for (const preset of PRESETS) {
  test.describe(`console · the deployment at one glance · ${preset.id}`, () => {
    test.use({viewport: preset.viewport, deviceScaleFactor: 1, screen: preset.viewport});

    test('two preludes → one: the size from the box, a line under each, the hero by size, the socket kept', async ({page, request}) => {
      test.setTimeout(420_000);
      const playerId = await bootDeployment(page, request, preset, ['Mohole', 'Business Empire'], ['Mohole', 'Business Empire', 'Loan', 'Donation']);
      await judge(page, preset, 'corp + two preludes');
      await shoot(page, preset, 'a0-corp-two-preludes');
      await playCorporation(page, request, playerId);
      expect(await focusCard(page, 'Mohole'), 'the cursor reached Mohole').toBe(true);
      await settle(page);
      await judge(page, preset, 'two preludes');
      const two = await settledScene(page, 'two preludes');
      expect(two.cards.find((c) => c.name === 'Mohole')?.reading?.verdict, 'a playable prelude reads «Можно разыграть»').toBe('playable');
      await walkKeepsStill(page, 'two preludes');
      await shoot(page, preset, 'a1-two-preludes');
      // (ж) — the prelude socket before the play IS the landing.
      const socket = (await settledScene(page, '(ж): the socket before the play')).shelf;
      expect(await playQueueCard(page, 'Mohole'), 'the prelude was played').toBe(true);
      await waitQueueIdle(page);
      await settle(page, {timeoutMs: 30_000});
      const after = await settledScene(page, '(ж): the shelf after the play');
      expect(after.shelf.length, '(ж): the shelf keeps its places').toBe(socket.length);
      after.shelf.forEach((r, i) => expect(near(socket[i], r), `(ж): shelf place ${i} ${JSON.stringify(socket[i])} → ${JSON.stringify(r)}`).toBe(true));
      await judge(page, preset, 'one prelude');
      // One to four cards share one geometry — the card that stayed did not grow when its neighbour left.
      const was = two.cards.find((c) => c.name === 'Business Empire' && !c.focused)?.rect.h;
      const now = after.cards.find((c) => c.name === 'Business Empire' && !c.focused)?.rect.h;
      if (was !== undefined && now !== undefined) {
        expect(Math.abs(was - now), 'the remaining card kept its size').toBeLessThanOrEqual(1);
      }
      await shoot(page, preset, 'b-one-prelude');
    });

    test('a waiting prelude beside its enabler: each reads its own verdict', async ({page, request}) => {
      test.setTimeout(360_000);
      const playerId = await bootDeployment(page, request, preset, ['Double Down', 'Business Empire'], ['Double Down', 'Business Empire', 'Loan', 'Donation']);
      await playCorporation(page, request, playerId);
      await judge(page, preset, 'waiting + enabler');
      const s = await settledScene(page, 'waiting + enabler');
      expect(s.cards.find((c) => c.name === 'Double Down')?.reading?.verdict, 'Double Down waits').toBe('waiting');
      expect(s.cards.find((c) => c.name === 'Business Empire')?.reading?.verdict, 'its enabler can be played').toBe('playable');
      await walkKeepsStill(page, 'waiting + enabler');
      await shoot(page, preset, 'c-waiting');
    });

    test('two preludes + bought projects: the row\'s other block first, nothing clipped', async ({page, request}) => {
      test.setTimeout(360_000);
      await bootDeployment(page, request, preset, ['Mohole', 'Business Empire'], ['Mohole', 'Business Empire', 'Loan', 'Donation'], 2);
      await judge(page, preset, 'two preludes + bought');
      await shoot(page, preset, 'd-bought');
    });
  });
}
