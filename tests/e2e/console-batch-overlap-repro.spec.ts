import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {NO_PAYMENT, createGameWithCards, fetchPlayerModel, openConsole, press, seedGameOverApi,
  sendPlayerInput, soloGameConfig, waitForBoardHome,
} from './consoleStart';

/**
 * P0.1 REPRO PROBE — the exact 20260830201630 sequence: a DP07 traversal with
 * the stage-5 deck stop and the stage-7 repeat. Samples EVERY frame-ish tick:
 * which card surfaces exist, which batch's cards each renders, and the
 * deck-pick flow phase — to catch the frame where TWO batches coexist.
 */

const OUT = path.resolve('screenshots', 'batch-overlap');

const TAG_CARDS = ['Solar Power', 'Development Manager', 'Space Station', 'Research', 'Adapted Lichen', 'Regolith Eaters'];
const ALL_CARDS = [...TAG_CARDS, 'Development Center', 'Delta Surge'];

const CFG = soloGameConfig({
  players: [{name: 'OverlapProbe', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {deltaProject: true},
  customProjectCards: ALL_CARDS,
  customCorporationsList: ['ThorGate'],
  seed: 0.47,
});

type Wire = Record<string, any>;

function titleOf(prompt: Wire | undefined): string {
  const t = prompt?.title;
  return typeof t === 'string' ? t : String(t?.message ?? '');
}

async function toActionMenu(request: APIRequestContext, id: string): Promise<Wire> {
  let model = await fetchPlayerModel(request, id) as Wire;
  for (let i = 0; i < 30; i++) {
    const prompt = model.waitingFor as Wire | undefined;
    if (prompt !== undefined && prompt.type === 'or' && /Take your (first|next) action/.test(titleOf(prompt))) {
      return prompt;
    }
    if (prompt === undefined) {
      await new Promise((r) => setTimeout(r, 400));
      model = await fetchPlayerModel(request, id) as Wire;
      continue;
    }
    if (prompt.type === 'space') {
      model = await sendPlayerInput(request, id,
        {type: 'space', spaceId: (prompt.spaces ?? [])[0]} as never) as Wire;
      continue;
    }
    model = prompt.type === 'card' ?
      await sendPlayerInput(request, id, {type: 'card', cards: []} as never) as Wire :
      await sendPlayerInput(request, id, {type: 'or', index: 0, response: {type: 'option'}} as never) as Wire;
  }
  expect(false, `never reached the action menu (stuck on ${titleOf(model.waitingFor as Wire)})`).toBeTruthy();
  return {};
}

function payMc(amount: number): Wire {
  return {...NO_PAYMENT, megacredits: amount};
}

async function playCard(request: APIRequestContext, id: string, card: string): Promise<void> {
  const menu = await toActionMenu(request, id);
  const at = (menu.options ?? []).findIndex((o: Wire) => titleOf(o) === 'Play project card');
  const offered = ((menu.options ?? [])[at].cards ?? []).find((c: Wire) => c.name === card);
  expect(offered, `${card} is in hand`).toBeDefined();
  await sendPlayerInput(request, id, {
    type: 'or', index: at,
    response: {type: 'projectCard', card, payment: payMc(offered.calculatedCost ?? 22)},
  } as never);
}

async function activateCard(request: APIRequestContext, id: string, card: string): Promise<void> {
  const menu = await toActionMenu(request, id);
  const at = (menu.options ?? []).findIndex((o: Wire) => titleOf(o) === 'Perform an action from a played card');
  await sendPlayerInput(request, id, {
    type: 'or', index: at,
    response: {type: 'card', cards: [card]},
  } as never);
}

test.describe('batch overlap repro · fhd', () => {
  test.use({
    viewport: {width: 1920, height: 1080},
    deviceScaleFactor: 1,
    screen: {width: 1920, height: 1080},
  });

  test('stage-5 pick close vs the repeat draw: sample surface coexistence', async ({page, request}) => {
    test.setTimeout(480_000);
    const id = await createGameWithCards(request, ALL_CARDS, {config: CFG, seed: 0.47});
    await seedGameOverApi(request, id, {cards: ALL_CARDS, corporation: 'ThorGate'});
    for (const card of ALL_CARDS) {
      await playCard(request, id, card);
    }
    await toActionMenu(request, id);
    await activateCard(request, id, 'Development Center');
    await toActionMenu(request, id);
    await openConsole(page, id, '');
    await page.waitForSelector('.con-reveal', {timeout: 25_000});
    for (let i = 0; i < 12 && await page.locator('.con-reveal').count() > 0; i++) {
      await press(page, 'Enter', 900);
    }
    await page.waitForSelector('.con-reveal', {state: 'detached', timeout: 25_000});
    await page.waitForTimeout(1800);
    await waitForBoardHome(page, 25);

    await press(page, 'Period', 1100);
    await press(page, 'ArrowLeft', 1600);
    await page.waitForSelector('.con-hydro', {timeout: 10_000});
    await press(page, 'Period', 900);

    // Resolve choices 1+2, then the repeat pick.
    await press(page, 'Enter', 900);
    await page.waitForSelector('.con-hydro__layer--choice', {timeout: 8_000});
    // ── P1.3 acceptance: the choice tiles wrap at WORD boundaries only and
    //    the check's clearance never starves the title column. ──
    const tiles = await page.evaluate(() => {
      const out: Array<{name: string, clipped: boolean, midBreak: boolean}> = [];
      document.querySelectorAll<HTMLElement>('.con-hydro__choice-card').forEach((card) => {
        const name = card.querySelector<HTMLElement>('.con-hydro__choice-name');
        if (name === null) {
          return;
        }
        const cs = window.getComputedStyle(name);
        out.push({
          name: (name.textContent ?? '').trim(),
          clipped: name.scrollWidth > name.clientWidth + 1,
          midBreak: cs.overflowWrap === 'anywhere' || cs.wordBreak === 'break-all',
        });
      });
      return out;
    });
    expect(tiles.length, 'two alternatives stand').toBeGreaterThan(1);
    for (const t of tiles) {
      expect(t.midBreak, `«${t.name}» never breaks inside a word`).toBe(false);
      expect(t.clipped, `«${t.name}» fits its column`).toBe(false);
    }
    await shoot(page, '00-choice-tiles');
    await press(page, 'Enter', 900);
    await press(page, 'Enter', 900);
    await page.waitForSelector('.con-hydro__layer--choice', {timeout: 8_000});
    await press(page, 'ArrowRight', 450);
    await press(page, 'Enter', 900);
    await press(page, 'Enter', 2500);
    await page.waitForSelector('.con-cardactions', {timeout: 15_000});
    await press(page, 'Enter', 2000);
    await press(page, 'Enter', 2500);
    await page.waitForSelector('.con-hydro', {timeout: 15_000});
    await page.waitForTimeout(800);

    // ── THE PROBE: per-tick, the FULL surface census. ──
    await page.evaluate(() => {
      const w = window as unknown as {
        __frames?: Array<{
          t: number,
          pickPhase: string | null,
          pickCards: string[],
          revealOn: boolean,
          revealKind: string,
          revealCards: string[],
          revealFit: string | null,
        }>,
        __probeStop?: () => void,
      };
      w.__frames = [];
      const sample = () => {
        const pick = document.querySelector('.con-deckpick');
        const pickCards = pick === null ? [] :
          Array.from(pick.querySelectorAll('[data-deckpick-slot]'))
            .filter((el) => (el as HTMLElement).offsetParent !== null &&
              window.getComputedStyle(el).opacity !== '0')
            .map((el) => el.getAttribute('data-deckpick-slot') ?? '');
        const reveal = document.querySelector('.con-reveal');
        const revealKind = reveal === null ? 'none' :
          reveal.classList.contains('con-reveal--headless') ? 'headless' :
            reveal.closest('.con-hydro__embed') !== null ? 'embedded' : 'fullscreen';
        const revealCards = reveal === null ? [] :
          Array.from(reveal.querySelectorAll('[data-zoom-slot]'))
            .map((el) => el.getAttribute('data-zoom-slot') ?? '');
        const strip = reveal?.querySelector('.con-reveal__strip') as HTMLElement | null | undefined;
        const frames = w.__frames!;
        const entry = {
          t: Math.round(performance.now()),
          pickPhase: pick?.getAttribute('data-flow') ?? null,
          pickCards, revealOn: reveal !== null, revealKind, revealCards,
          revealFit: strip?.dataset.fit ?? null,
        };
        const prev = frames[frames.length - 1];
        if (prev === undefined || JSON.stringify({...prev, t: 0}) !== JSON.stringify({...entry, t: 0})) {
          frames.push(entry);
        }
      };
      const mo = new MutationObserver(sample);
      mo.observe(document.body, {childList: true, subtree: true, attributes: true});
      const iv = setInterval(sample, 40);
      w.__probeStop = () => {
        mo.disconnect();
        clearInterval(iv);
      };
    });

    // COMMIT → stage-5 stop → pick 2 → confirm → watch the handover.
    await press(page, 'Enter', 1500);
    await page.waitForSelector('.con-deckpick[data-flow="choosing"]', {timeout: 60_000});
    await press(page, 'Enter', 600);
    for (let i = 0; i < 6 && await page.locator('.con-cards__slot--picked').count() < 2; i++) {
      await press(page, 'ArrowRight', 450);
      await press(page, 'Enter', 600);
    }
    await press(page, 'Period', 1500); // RT — confirm

    await page.waitForSelector('.con-hydro__embed .con-reveal--embedded', {timeout: 60_000});
    await shoot(page, '01-during');
    for (let i = 0; i < 12 && await page.locator('.con-reveal--embedded').count() > 0; i++) {
      await press(page, 'Enter', 900);
    }
    await page.waitForSelector('.con-hydro__result-stages', {timeout: 90_000});
    await page.evaluate(() => (window as unknown as {__probeStop?: () => void}).__probeStop?.());

    const frames = await page.evaluate(() =>
      (window as unknown as {__frames?: unknown[]}).__frames ?? []);
    fs.mkdirSync(OUT, {recursive: true});
    fs.writeFileSync(path.join(OUT, 'frames.json'), JSON.stringify(frames, null, 1));

    // ── THE ONE-BATCH INVARIANT: no sampled tick may show a deck pick's
    //    cards AND a reveal's cards together (the 20260830201630 defect).
    //    The message carries the offending ticks — the next failure names
    //    the two batches, not just «overlap». ──
    type F = {t: number, pickPhase: string | null, pickCards: string[], revealOn: boolean, revealKind: string, revealCards: string[], revealFit: string | null};
    const overlap = (frames as F[]).filter((f) =>
      f.pickCards.length > 0 && f.revealCards.length > 0);
    expect(overlap, `two card batches shared a frame: ${JSON.stringify(overlap.slice(0, 6))}`)
      .toEqual([]);
    // The repeat's own reveal presented EMBEDDED (never the standalone band
    // over the track), and its measured fit landed (no ladder fallback).
    const revealFrames = (frames as F[]).filter((f) => f.revealOn && f.revealCards.length > 0);
    expect(revealFrames.length, 'the repeat draw presented').toBeGreaterThan(0);
    expect(revealFrames.every((f) => f.revealKind === 'embedded'),
      `every presenting frame is embedded (${JSON.stringify([...new Set(revealFrames.map((f) => f.revealKind))])})`)
      .toBe(true);
    const fits = (frames as F[]).map((f) => f.revealFit)
      .filter((v, i, a): v is string => v !== null && a.indexOf(v) === i);
    expect(fits.length, 'the shared fit engine measured the embedded strip').toBeGreaterThan(0);
    // The presented hero spends the band: zoom ≥ .9 of the solved slot (the
    // «compact thumbnails in a huge empty scene» regression floor).
    for (const fit of fits) {
      const z = Number(/→ z([\d.]+)/.exec(fit)?.[1] ?? '0');
      expect(z, `an honest hero fit (${fit})`).toBeGreaterThan(0.9);
    }
    expect((frames as F[]).length).toBeGreaterThan(3);
  });
});

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}
