import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, bootSeededGame, createGameWithCards, playCardFromHand, press, soloGameConfig} from './consoleStart';

/**
 * THE PLACEMENT DOSSIER — the right-hand board panel, photographed.
 *
 * A VISUAL probe: it drives the four contrasting shapes of the same surface
 * (a plain legal cell · a cell whose neighbourhood taxes the placement · a
 * special-tile placement · an illegal cell) and shoots each one at 4K TV,
 * which is the profile the panel is designed for.
 *
 * Deliberately ASSERTION-LIGHT and selector-free about the panel's own
 * markup: it must run unchanged against the PREVIOUS build too, so a
 * before/after pair is the same drive photographed twice. What it does
 * assert is only that the drive arrived (a placement is live, the cursor
 * reached the cell the shot is named after) — a screenshot of the wrong
 * state is worse than no screenshot.
 *
 * Structural claims about the panel live in the unit specs
 * (`ConsoleContextPanel.spec.ts`, `placementDossier.spec.ts`) and in the two
 * source probes (`console-placement-source`, `console-hazard-placement`).
 */

const OUT = path.resolve('screenshots', process.env.DOSSIER_OUT ?? 'placement-dossier');

/**
 * A solo ARES game — hazards are what taxes a placement.
 *
 * ⚠️ NOT REPRODUCIBLE, whatever `seed` says. `/api/creategame` never reads the
 * field: `ApiCreateGame.ts` calls `Math.random()` for every game it builds, so
 * the seed below documents an intent the server does not honour. Only the
 * EXPLICIT lists (`customPreludes`, `includedCards`, `bannedCards`) are forced;
 * the Ares hazard layout is drawn from the shuffled deck (`discardForCost`) and
 * therefore differs on every run — measured: three creations with this exact
 * config produced three disjoint hazard layouts.
 *
 * So everything below has to hold for ANY board this config can deal: the
 * sweep covers the whole map rather than trusting a remembered cell, and the
 * fit assertions name the cell they failed on.
 */
function aresConfig(overrides: Record<string, unknown> = {}) {
  return {
    players: [{name: 'Dossier', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: true, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis',
    seed: 0.42,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    testMode: true,
    aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard',
    solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false,
    modularMA: false,
    draftVariant: false,
    initialDraft: false,
    preludeDraftVariant: false,
    ceosDraftVariant: false,
    startingCorporations: 2,
    shuffleMapOption: false,
    randomMA: 'No randomization',
    includeFanMA: false,
    soloTR: false,
    customCorporationsList: [],
    bannedCards: [],
    includedCards: [],
    customColoniesList: [],
    customPreludes: [],
    requiresMoonTrackCompletion: false,
    requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false,
    moonStandardProjectVariant1: false,
    altVenusBoard: false,
    escapeVelocity: undefined,
    twoCorpsVariant: false,
    customCeos: [],
    startingCeos: 3,
    startingPreludes: 4,
    ...overrides,
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/**
 * A frame pump. Headless Chromium drives rAF off the compositor, so on a
 * quiet screen the APP's own settle chains starve — and a screenshot is what
 * forces a BeginFrame (see the tv-reading-matrix precedent).
 */
async function pump(page: Page): Promise<void> {
  await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}});
}

async function key(page: Page, code: string, settle = 420): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
  await pump(page);
}

const panelOf = (page: Page) => page.locator('.con-context');

/**
 * The focused cell, and whether the placement ACCEPTS it — read off the
 * board, never off the panel's own copy: the new panel keeps the refusal in
 * an always-mounted (collapsed) well, so a text probe cannot tell the two
 * states apart, and the old one has no such marker at all. `--available` is
 * the same class `selectedCellLegal` itself reads.
 */
async function focusedCell(page: Page): Promise<{id: string, legal: boolean}> {
  // `.con-cell-sel` is the console board's own spotlight class
  // (`ConsoleBoardSection.SELECT_CLASS`) — the cursor, not the legacy
  // desktop `--selected` (which only exists after a pick is committed).
  return page.evaluate(() => {
    const el = document.querySelector('.con-cell-sel[data_space_id]');
    return {
      id: el?.getAttribute('data_space_id') ?? '',
      legal: el?.classList.contains('board-space--available') ?? false,
    };
  });
}

/**
 * Drive the board cursor to a KNOWN corner.
 *
 * The sweep below has to start somewhere reproducible: the cursor is seeded
 * wherever the placement opened it, and the previous sweep left it wherever
 * its own target was. Both arrow axes CLAMP at the board's edge, so spamming
 * up-left is a homing move that costs nothing and cannot overshoot.
 */
async function homeCursor(page: Page): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(90);
  }
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(90);
  }
  await pump(page);
}

/**
 * Walk the board cursor until `hit` answers true.
 *
 * ⭐ THE SWEEP MUST COVER THE BOARD, and the old one covered a STRIP. Its
 * pattern was «right ×3 · down · left ×3 · down», which never crosses a
 * 9-column map: after a dozen steps it hits the bottom, `ArrowDown` clamps,
 * and the rest of the budget oscillates inside the same four columns. Whether
 * a hazard-adjacent cell happened to live in that strip depended on where the
 * PREVIOUS sweep had left the cursor — so the same seeded game found the taxed
 * cell on one attempt and «did not exist» on the next, three times over two
 * CI runs.
 *
 * So: home first (a reproducible origin), cross the WHOLE row, and stop on the
 * board's own evidence rather than on a step count — when a full lane adds no
 * cell the sweep has not already visited, there is nothing left to see. The
 * failure then reports how much board it actually covered, which is the one
 * fact that tells «the cell is not there» from «the walk never got there».
 */
async function walkUntil(
  page: Page,
  hit: (text: string, cell: {id: string, legal: boolean}) => boolean,
  opts: {budget?: number, home?: boolean} = {}): Promise<string> {
  const budget = opts.budget ?? 150;
  const panel = panelOf(page);
  // HOMING SERVES THE SEARCH FOR A RARE CELL, and only that. A caller looking
  // for ANY legal cell wants the one NEAR the cursor the placement seeded —
  // sending it to the corner first is strictly worse, and turned a two-step
  // walk into one that leaves the board's legal region behind.
  if (opts.home !== false) {
    await homeCursor(page);
  }
  // A full-width serpentine: 9 columns is the widest Tharsis row, and a
  // clamped extra press is free.
  const lane: Array<string> = [
    ...Array(9).fill('ArrowRight'), 'ArrowDown',
    ...Array(9).fill('ArrowLeft'), 'ArrowDown',
  ];
  const seen = new Set<string>();
  let newThisLane = 0;
  for (let i = 0; i < budget; i++) {
    // ⚠️ COUNT PER LANE, never «steps since something new». Most presses in a
    // lane are CLAMPED by design (nine rights cross the widest row, so every
    // shorter row spends the rest of them standing still), and a run-length
    // rule reads that as «the board is exhausted» — it aborted this sweep
    // after 20 cells of a 61-cell map. A whole lane that adds nothing is the
    // honest end condition.
    if (i > 0 && i % lane.length === 0) {
      if (newThisLane === 0) {
        break;
      }
      newThisLane = 0;
    }
    const cell = await focusedCell(page);
    const text = await panel.innerText().catch(() => '');
    if (text !== '' && hit(text, cell)) {
      return text;
    }
    if (cell.id !== '' && !seen.has(cell.id)) {
      seen.add(cell.id);
      newThisLane++;
    }
    await key(page, lane[i % lane.length], 300);
  }
  console.log(`[dossier] sweep found nothing across ${seen.size} cells`);
  return '';
}

/** The placement panel is up (the kicker names a tile / marker placement). */
async function placementLive(page: Page): Promise<boolean> {
  const text = (await panelOf(page).innerText().catch(() => '')).toUpperCase();
  return text.includes('РАЗМЕЩЕНИЕ');
}

/**
 * THE PANEL MUST FIT. A standard placement that overflows is the defect this
 * iteration exists to remove: the scroll cut the endgame block off, and the
 * `R3 ПРОКРУТКА` badge then sat ON the text it was hiding.
 */
async function panelFit(page: Page): Promise<{overflow: number, scrollHint: number}> {
  return page.evaluate(() => {
    const el = document.querySelector('.con-inspector') as HTMLElement | null;
    return {
      overflow: el === null ? -1 : el.scrollHeight - el.clientHeight,
      scrollHint: document.querySelectorAll('.con-inspector__more').length,
    };
  });
}

async function expectFits(page: Page, what: string): Promise<void> {
  const fit = await panelFit(page);
  // NAME THE CELL. The board is not reproducible (see `aresConfig`), so «the
  // panel overflowed» is only actionable together with WHICH cell was under
  // the cursor — the density that overflows lives on some cells and not on
  // others, and the next run will be looking at a different board.
  const cell = await focusedCell(page);
  const where = `${what} (cell ${cell.id})`;
  expect(fit.overflow, `${where}: the panel overflows by ${fit.overflow}px`).toBeLessThanOrEqual(2);
  expect(fit.scrollHint, `${where}: the scroll affordance is showing`).toBe(0);
}

test.describe.configure({mode: 'serial'});

test.describe('console placement dossier · 4K TV', () => {
  test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1, screen: {width: 3840, height: 2160}});

  test('greenery: a plain cell, a taxed cell, and an illegal cell', async ({page, request}) => {
    test.setTimeout(420_000);
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));

    const playerId = await createGameWithCards(request, [], {config: aresConfig()});
    await bootSeededGame(page, request, playerId, {query: '&consoleProfile=tv'});
    await page.waitForTimeout(1200);
    await shoot(page, '00-board-home');

    // LT wheel → «КОНВЕРТАЦИЯ РАСТЕНИЙ» is the LEFT slot. The wheel is
    // PRESS→RELEASE: the direction ARMS the slot and FIRES it on key-up, so
    // the arrow alone activates it (an extra Enter would commit the tile).
    await key(page, 'Comma', 1400);
    await key(page, 'ArrowLeft', 2800);
    expect(await placementLive(page), 'never reached the board placement').toBeTruthy();

    // ── 1 · A PLAIN legal cell: no toll, the ordinary result.
    const plain = await walkUntil(page, (text, cell) =>
      cell.legal && !text.includes('Снизить производство'));
    expect(plain, 'no plain legal cell surfaced').not.toBe('');
    await page.waitForTimeout(700); // the per-cell preview is fetched
    await pump(page);
    await shoot(page, '01-greenery-plain-cell');
    await expectFits(page, 'a plain greenery cell');

    // ── 2 · A TAXED cell: the Ares hazard-adjacency production penalty. The
    //        match is the PENALTY, never any «производство» line (a greenery
    //        legitimately mentions other players' production gains).
    const taxed = await walkUntil(page, (text, cell) =>
      cell.legal && text.includes('Снизить производство'));
    expect(taxed, 'no hazard-adjacent cell surfaced a production penalty').not.toBe('');
    await page.waitForTimeout(700);
    await pump(page);
    await shoot(page, '02-greenery-hazard-penalty');
    await expectFits(page, 'a hazard-taxed greenery cell');

    // ── 3 · An ILLEGAL cell: R3 opens the whole board («ВСЕ КЛЕТКИ»), so the
    //        cursor can reach a cell the placement refuses.
    await key(page, 'KeyV', 1200); // R3 — inspect all cells
    const illegal = await walkUntil(page, (_text, cell) => cell.id !== '' && !cell.legal);
    expect(illegal, 'no illegal cell surfaced a refusal').not.toBe('');
    await page.waitForTimeout(700);
    await pump(page);
    await shoot(page, '03-greenery-illegal-cell');
    await expectFits(page, 'an illegal cell');
  });

  /**
   * THE CITY — the shape the report was filed against. A city placement
   * carries the project's own production, the cell's toll, the standing and
   * the endgame forecast at once, which is precisely the density that used to
   * overflow the panel and push «В КОНЦЕ ИГРЫ» under the command bar.
   *
   * (That the ENGINE emits two separate facts about ONE parameter, and that
   * the console collapses them into a single honest vector, is pinned where
   * it is deterministic — `tests/boards/placementAggregation.spec.ts` — not
   * by driving a keyboard for four minutes.)
   */
  test('a city from the standard project fits, on a plain and on a taxed cell', async ({page, request}) => {
    test.setTimeout(420_000);
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));

    const playerId = await createGameWithCards(request, [], {config: aresConfig({seed: 0.42})});
    await bootSeededGame(page, request, playerId, {query: '&consoleProfile=tv'});
    await page.waitForTimeout(1200);

    // LT wheel → «СТАНДАРТНЫЕ ПРОЕКТЫ» (the centre slot) → the projects sheet.
    await key(page, 'Comma', 1500);
    await key(page, 'Enter', 1900);
    const focusedProject = () =>
      page.locator('.con-stdp__card--focused .con-stdp__name').innerText().catch(() => '');
    const walk = ['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft',
      'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowDown'];
    for (let i = 0; i <= walk.length && !/город/i.test(await focusedProject()); i++) {
      await key(page, walk[i % walk.length], 430);
    }
    expect(await focusedProject(), 'never focused «Город»').toMatch(/город/i);
    await key(page, 'Enter', 2000);
    if (/ОПЛАТА/.test(await page.locator('.con-root').innerText())) {
      await key(page, 'KeyX', 2800);
    }
    for (let i = 0; i < 10 && !(await placementLive(page)); i++) {
      await pump(page);
      await page.waitForTimeout(700);
    }
    expect(await placementLive(page), 'the city project never reached the board').toBeTruthy();

    const plain = await walkUntil(page, (text, cell) =>
      cell.legal && !text.includes('Снизить производство'));
    expect(plain, 'no plain legal cell surfaced').not.toBe('');
    await page.waitForTimeout(800);
    await pump(page);
    await shoot(page, '05-city-plain-cell');
    await expectFits(page, 'a plain city cell');

    const taxed = await walkUntil(page, (text, cell) =>
      cell.legal && text.includes('Снизить производство'));
    expect(taxed, 'no hazard-adjacent cell surfaced a production penalty').not.toBe('');
    await page.waitForTimeout(800);
    await pump(page);
    await shoot(page, '06-city-hazard-penalty');
    await expectFits(page, 'a hazard-taxed city cell');
  });

  /**
   * THE NATURAL PRESERVE REPORT — the placed tile's OWN standing mechanic.
   * Its Ares adjacency grant used to land inside «ПРАВИЛА ПОЛЯ» clamped to
   * two lines («Ваш тайл будет давать бонус за…») over a half-empty panel.
   * Now: its own «ПРИ РАЗМЕЩЕНИИ РЯДОМ» section, the full sentence visible,
   * and «Без штрафа» as one word on the cell line rather than a section.
   */
  test('the placed tile’s adjacency mechanic is a full, unclipped trigger section', async ({page, request}) => {
    test.setTimeout(420_000);
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));

    await bootIntoGame(page, request, {
      config: aresConfig({seed: 0.23}),
      cards: ['Natural Preserve:ares'],
      query: '&consoleProfile=tv',
    });
    await page.waitForTimeout(1200);

    expect(await playCardFromHand(page, 'Natural Preserve:ares'), 'never played the card').toBeTruthy();
    for (let i = 0; i < 14 && !(await placementLive(page)); i++) {
      await pump(page);
      await page.waitForTimeout(800);
    }
    for (let i = 0; i < 3 && !(await placementLive(page)); i++) {
      await press(page, 'Enter', 1500);
      await pump(page);
    }
    expect(await placementLive(page), 'the tile never reached the board').toBeTruthy();
    // The sweep HOMES first, so a tiny budget no longer means «a few steps
    // from wherever the placement seeded the cursor» — it means «a few steps
    // from the corner», which reaches no legal cell at all. Let the sweep run:
    // it stops at the FIRST legal cell either way, and now it is reproducible.
    // SEARCH FOR WHAT THE TEST NEEDS, not for «any legal cell». The tile's
    // standing mechanic is a section the SERVER emits per cell
    // (`placementDossier.ts` → `section('tile', …)` only when that cell's
    // preview carries standing rule facts), so a walk that stops at the first
    // legal square is asserting on a cell that may never have been asked to
    // show one — which is exactly how this passed for as long as the old
    // 4-column walk happened to land well, and failed the moment it landed
    // elsewhere. Sweep the whole board for the section itself; if no cell on
    // this (unseeded, see `aresConfig`) board shows it, THAT is the finding.
    expect(await walkUntil(page, (text, cell) => cell.legal && /ПРИ РАЗМЕЩЕНИИ РЯДОМ/i.test(text)),
      "no legal cell showed the tile's own adjacency mechanic").not.toBe('');
    await page.waitForTimeout(900);
    await pump(page);
    await shoot(page, '07-natural-preserve-adjacency');

    const panel = panelOf(page);
    // ① The tile's standing mechanic is its OWN section, not a field rule.
    const tileSec = panel.locator('.con-context__sec--tile');
    await expect(tileSec).toHaveCount(1);
    await expect(tileSec).toContainText(/ПРИ РАЗМЕЩЕНИИ РЯДОМ/i);
    await expect(tileSec).toContainText(/Бонус соседу/i);

    // ② The trigger → outcome sentence is COMPLETE — nothing clipped. A
    //    text assertion cannot prove visibility (innerText survives a clamp),
    //    so measure the note's own box: a clamped element overflows itself.
    const clip = await page.evaluate(() => {
      const notes = Array.from(document.querySelectorAll(
        '.con-context__sec--tile .con-dossier-row__note, .con-context__sec--tile .con-dossier-row__title'));
      return notes.map((el) => ({
        text: (el.textContent ?? '').slice(0, 40),
        overflow: el.scrollHeight - el.clientHeight,
      }));
    });
    expect(clip.length, 'the trigger row renders its sentence').toBeGreaterThan(0);
    for (const c of clip) {
      expect(c.overflow, `«${c.text}…» is clipped by ${c.overflow}px`).toBeLessThanOrEqual(2);
    }

    // ③ «Без штрафа» costs one word on the cell line, never a section, and
    //    the whole reading still fits without the scroll.
    await expect(panel.locator('.con-context__sec--effect')).toHaveCount(0);
    await expect(panel.locator('.con-context__cell-tail')).toHaveCount(1);
    await expectFits(page, 'the Natural Preserve placement');
  });

  test('a named SPECIAL tile names itself', async ({page, request}) => {
    test.setTimeout(420_000);
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));

    // «Запретная зона» places a NAMED special tile on any ordinary land — no
    // requirement, so the drive is the play itself and nothing else.
    //
    // Deliberately NOT the Ares game above: the Ares module REPLACES this card
    // with its own variant (`Restricted Area:ares`), so asking for the base
    // name there searches 80 deals for a card that cannot be dealt.
    await bootIntoGame(page, request, {
      config: soloGameConfig({seed: 0.11}),
      cards: ['Restricted Area'],
      query: '&consoleProfile=tv',
    });
    await page.waitForTimeout(1200);

    expect(await playCardFromHand(page, 'Restricted Area'), 'never played the card').toBeTruthy();
    // The play's own landing scene runs before the board takes over.
    for (let i = 0; i < 12 && !(await placementLive(page)); i++) {
      await pump(page);
      await page.waitForTimeout(900);
    }
    // A composer still standing (a leftover confirm) yields to A.
    for (let i = 0; i < 3 && !(await placementLive(page)); i++) {
      await press(page, 'Enter', 1500);
      await pump(page);
    }
    expect(await placementLive(page), 'the special tile never reached the board').toBeTruthy();
    expect(await walkUntil(page, (_text, cell) => cell.legal, {budget: 24, home: false}),
      'no legal cell surfaced for the special tile').not.toBe('');
    // ⚠️ LET THE PLANET SETTLE BEFORE SHOOTING. Planet focus zooms the board
    // on a CSS transition, and headless Chromium drives those off the
    // compositor — on a quiet screen the zoom simply stops half-way, and the
    // screenshot then shows a planet that is neither the old size nor the new
    // one (it read as a geometry regression until a second run disproved it).
    // Pumping frames is what finishes it.
    for (let i = 0; i < 8; i++) {
      await pump(page);
      await page.waitForTimeout(220);
    }
    await shoot(page, '04-special-tile');
  });
});
