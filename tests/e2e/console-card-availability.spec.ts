import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createGameWithCards, openConsole, seedGameOverApi, soloGameConfig,
  waitForBoardHome, press,
} from './consoleStart';
import {openHand} from './cardTradeDoor';

/**
 * CARD AVAILABILITY — the unified system at its real surface, and the RIGHT
 * COLUMN's geometry, at two resolutions.
 *
 * The hand is deterministic:
 *   · «Озеро Маринер» — one requirement blocker (0°C at a −30°C table);
 *   · «Домашний скот» — the LAYOUT case: four rule sections (requirement /
 *     action / on-play / VP) AND several reasons at once, i.e. the card that
 *     used to push the availability panel under the command bar;
 *   · «Комета» — the control: playable, so NO availability panel at all.
 *
 * Every assertion about the column is MEASURED against the real boxes: the
 * availability panel leads, both panels sit entirely above the command bar
 * and below the page counter, availability is never clipped, the «ПРАВИЛА»
 * head never collapses, and the column's top edge does not move when paging
 * between a card that has a panel and one that has not.
 */

test.describe.configure({mode: 'serial'});

const CARDS = ['Lake Marineris', 'Comet', 'Livestock'];
const CORP = 'Helion';
const OUT = path.join('screenshots', 'card-availability');

const PRESETS = [
  {tag: 'tv-4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
] as const;

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** Headless Chromium starves rAF on a static frame — force a BeginFrame. */
async function forceFrame(page: Page): Promise<void> {
  await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => {});
}

async function openZoomForced(page: Page): Promise<void> {
  const zoom = page.locator('dialog.con-zoom[open]');
  for (let i = 0; i < 14 && await zoom.count() === 0; i++) {
    await press(page, 'KeyX', 900);
    await forceFrame(page);
  }
  await expect(zoom, 'the fullscreen viewer opened').toHaveCount(1, {timeout: 8_000});
  await page.waitForTimeout(1300); // the open flight + settle nonce
}

async function closeZoomForced(page: Page): Promise<void> {
  const zoom = page.locator('dialog.con-zoom[open]');
  for (let i = 0; i < 10 && await zoom.count() > 0; i++) {
    await press(page, 'Escape', 1100);
    await forceFrame(page);
  }
  await expect(zoom, 'the fullscreen viewer closed').toHaveCount(0, {timeout: 8_000});
}

/** The hand verdict bar's current card name + its first reason line. */
async function handVerdict(page: Page) {
  return await page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>('.con-hand__verdictbar');
    return {
      name: (bar?.querySelector<HTMLElement>('.con-cards__verdict-name')?.innerText ?? '').trim(),
      blocked: bar?.classList.contains('con-hand__verdictbar--blocked') ?? false,
      ok: bar?.classList.contains('con-hand__verdictbar--ok') ?? false,
      reasons: Array.from(bar?.querySelectorAll<HTMLElement>('.con-hand__reason--bar') ?? [])
        .map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
    };
  });
}

/**
 * Walk the album until the named card is focused (names are localized). The
 * hand is sorted playable-first, so the target may be on either side of the
 * cursor — a press that does not move the focus means the edge, so turn back.
 */
async function focusCard(page: Page, ruName: string): Promise<void> {
  const target = ruName.toLowerCase();
  let dir: 'ArrowRight' | 'ArrowLeft' = 'ArrowRight';
  let previous = '';
  for (let i = 0; i < 10; i++) {
    const name = (await handVerdict(page)).name.toLowerCase();
    if (name === target) {
      return;
    }
    if (name === previous) {
      dir = dir === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight'; // an album edge
    }
    previous = name;
    await press(page, dir, 650);
    await forceFrame(page);
  }
  expect((await handVerdict(page)).name.toLowerCase(), `focused «${ruName}»`).toBe(target);
}

async function zoomAvailability(page: Page) {
  return await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('.con-zoom-sidecol .con-cardavail--panel');
    if (el === null) {
      return undefined;
    }
    return {
      severity: el.getAttribute('data-severity') ?? '',
      verdict: (el.querySelector<HTMLElement>('.con-cardavail__verdict')?.innerText ?? '').replace(/\s+/g, ' ').trim(),
      reasons: Array.from(el.querySelectorAll<HTMLElement>('.con-cardavail__reason .con-cardavail__text'))
        .map((r) => r.innerText.replace(/\s+/g, ' ').trim()),
    };
  });
}

/**
 * THE COLUMN GEOMETRY — the whole point of the layout pass. Everything is
 * measured against the real boxes.
 */
async function sideColumnGeometry(page: Page) {
  return await page.evaluate(() => {
    const col = document.querySelector<HTMLElement>('.con-zoom-sidecol');
    const avail = document.querySelector<HTMLElement>('.con-zoom-sidecol .con-cardavail--panel');
    const rules = document.querySelector<HTMLElement>('.con-zoom-sidecol .con-zoom-rules');
    const footer = document.querySelector<HTMLElement>('.con-zoom .card-zoom-actions');
    const counter = document.querySelector<HTMLElement>('.con-zoom .card-zoom-topbar');
    const body = document.querySelector<HTMLElement>('.con-zoom-rules__scroll .con-scroll-area__viewport');
    const head = document.querySelector<HTMLElement>('.con-zoom-rules__head');
    const box = (el: HTMLElement | null) => el === null ? undefined : (() => {
      const r = el.getBoundingClientRect();
      return {top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), width: Math.round(r.width)};
    })();
    return {
      col: box(col),
      avail: box(avail),
      rules: box(rules),
      head: box(head),
      footerTop: footer === null ? undefined : Math.round(footer.getBoundingClientRect().top),
      counterBottom: counter === null ? undefined : Math.round(counter.getBoundingClientRect().bottom),
      viewportH: window.innerHeight,
      // The availability panel must never need a scroll of its own.
      availClipped: avail === null ? false : avail.scrollHeight > avail.clientHeight + 1,
      rulesBodyScrolls: body !== null && body.scrollHeight > body.clientHeight + 1,
    };
  });
}

type Geometry = Awaited<ReturnType<typeof sideColumnGeometry>>;

/** Every panel of the column sits ABOVE the command bar and inside the viewport. */
function assertColumnFits(g: Geometry, label: string): void {
  expect(g.footerTop, `${label}: the command bar is measurable`).toBeTruthy();
  expect(g.col, `${label}: the column exists`).toBeTruthy();
  const footerTop = g.footerTop ?? 0;
  for (const [name, b] of [['availability', g.avail], ['rules', g.rules]] as const) {
    if (b === undefined) {
      continue;
    }
    expect(b.bottom, `${label}: ${name} stays above the command bar`).toBeLessThanOrEqual(footerTop + 1);
    expect(b.top, `${label}: ${name} stays below the page counter`).toBeGreaterThanOrEqual((g.counterBottom ?? 0) - 1);
    expect(b.bottom, `${label}: ${name} stays inside the viewport`).toBeLessThanOrEqual(g.viewportH);
    expect(b.height, `${label}: ${name} has real height`).toBeGreaterThan(0);
  }
  expect(g.availClipped, `${label}: availability is never clipped or scrolled`).toBeFalsy();
  if (g.avail !== undefined && g.rules !== undefined) {
    expect(g.avail.top, `${label}: AVAILABILITY leads the column`).toBeLessThan(g.rules.top);
    expect(g.avail.width, `${label}: both panels share one width`).toBe(g.rules.width);
  }
  if (g.rules !== undefined && g.head !== undefined) {
    expect(g.head.height, `${label}: the «ПРАВИЛА» head never collapses`).toBeGreaterThan(0);
    expect(g.head.bottom, `${label}: the head is inside the rules box`).toBeLessThanOrEqual(g.rules.bottom + 1);
  }
}

for (const preset of PRESETS) {
  test.describe(`card availability · column geometry · ${preset.tag}`, () => {
    test.use({
      viewport: {width: preset.width, height: preset.height},
      deviceScaleFactor: 1,
      screen: {width: preset.width, height: preset.height},
    });

    test('availability leads the rules and the column never reaches the footer', async ({page, request}) => {
      test.setTimeout(360_000);

      const config = soloGameConfig({
        customProjectCards: CARDS,
        customCorporationsList: [CORP, 'Saturn Systems'],
      });
      const playerId = await createGameWithCards(request, [...CARDS, CORP], {config});
      await seedGameOverApi(request, playerId, {cards: CARDS, corporation: CORP});
      await openConsole(page, playerId, preset.query);
      await waitForBoardHome(page, 25);
      await openHand(page);

      // ── 1 · A REQUIREMENT-BLOCKED card: the verdict bar and the fullscreen
      //    panel read the same thing (ONE view-model, two densities).
      await focusCard(page, 'Озеро Маринер');
      const blocked = await handVerdict(page);
      console.log(`[${preset.tag}] hand verdict`, JSON.stringify(blocked));
      expect(blocked.blocked, 'the requirement-blocked card wears the red verdict').toBeTruthy();
      expect(blocked.reasons[0]?.length, 'the concrete server reason is on the bar').toBeGreaterThan(0);
      await shoot(page, preset.tag, '01-hand-blocked-verdict');

      await openZoomForced(page);
      const panel = await zoomAvailability(page);
      const g1 = await sideColumnGeometry(page);
      console.log(`[${preset.tag}] blocked fullscreen`, JSON.stringify({panel, g1}));
      expect(panel, 'the availability panel joined the column').toBeTruthy();
      expect(panel?.severity).toBe('blocked');
      expect(panel?.reasons[0], 'the SAME primary reason in both densities').toBe(blocked.reasons[0]);
      assertColumnFits(g1, 'blocked card');
      await shoot(page, preset.tag, '02-fullscreen-availability');

      // ── 2 · THE LAYOUT CASE — «Домашний скот»: four rule sections AND
      //    several reasons. This is the composition that used to push the
      //    availability panel under the command bar.
      await closeZoomForced(page);
      await focusCard(page, 'Домашний скот');
      const stock = await handVerdict(page);
      console.log(`[${preset.tag}] livestock verdict`, JSON.stringify(stock));
      await openZoomForced(page);
      const stockPanel = await zoomAvailability(page);
      const g2 = await sideColumnGeometry(page);
      console.log(`[${preset.tag}] livestock fullscreen`, JSON.stringify({stockPanel, g2}));
      expect(stockPanel, 'the dense card still shows its availability').toBeTruthy();
      expect(stockPanel?.reasons.length, 'every reason is listed in the fullscreen').toBeGreaterThan(0);
      // Reason PARITY: the bar shows the first rows of the same ordered list.
      expect(stockPanel?.reasons.slice(0, stock.reasons.length)).toEqual(stock.reasons);
      assertColumnFits(g2, 'dense card');
      // The rules body may take an internal scroll here — that is the LAST
      // resort and is allowed; the availability panel above it may not.
      console.log(`[${preset.tag}] rules body scrolls: ${g2.rulesBodyScrolls}`);
      await shoot(page, preset.tag, '03-dense-card-column');

      // ── 3 · A STABLE TOP EDGE across cards with and without a panel: the
      //    column must not jump when paging (RB → the playable card).
      const topBefore = g2.col?.top;
      await closeZoomForced(page); // the album owns the d-pad again
      await focusCard(page, 'Комета');
      const ok = await handVerdict(page);
      expect(ok.ok, 'the playable card wears the green verdict').toBeTruthy();
      await openZoomForced(page);
      const noPanel = await zoomAvailability(page);
      const g3 = await sideColumnGeometry(page);
      console.log(`[${preset.tag}] playable fullscreen`, JSON.stringify({noPanel, g3}));
      expect(noPanel, 'a playable card shows NO availability panel').toBeUndefined();
      assertColumnFits(g3, 'playable card');
      expect(g3.col?.top, 'the column top edge is identical with and without the panel').toBe(topBefore);
      await shoot(page, preset.tag, '04-playable-no-panel');
      await closeZoomForced(page);
    });
  });
}
