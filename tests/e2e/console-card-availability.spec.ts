import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createGameWithCards, openConsole, seedGameOverApi, soloGameConfig,
  waitForBoardHome, press,
} from './consoleStart';
import {openHand} from './cardTradeDoor';

/**
 * CARD AVAILABILITY — the POSITIVE end-to-end of the unified system, at the
 * real surface (tv-4k), with a DETERMINISTIC hand:
 *
 *   «Озеро Маринер» (Lake Marineris, requires 0°C at a −30°C table) — a
 *   requirement-blocked card in the PLAY context:
 *     · the hand verdict bar goes red («Нельзя разыграть») with the server's
 *       requirement line;
 *     · X-fullscreen shows the «ДОСТУПНОСТЬ» panel below «ПРАВИЛА» with the
 *       SAME severity and the SAME primary reason (parity is the point — one
 *       view-model feeds both);
 *     · the rules panel keeps its no-scroll contract (the availability panel
 *       may never squeeze it).
 *
 *   «Комета» (Comet, playable with Helion's 42 M€ + heat) — the control:
 *     · a playable card shows NO availability panel (never an empty box).
 *
 * The draft-side voices («пока не выполнено» / «уже не выполнить») are unit-
 * covered (cardAvailability.spec.ts, unplayableReasons.spec.ts) and probed
 * conditionally in console-draft-workspace.spec.ts.
 */

test.describe.configure({mode: 'serial'});

const CARDS = ['Lake Marineris', 'Comet'];
const CORP = 'Helion';
const OUT = path.join('screenshots', 'card-availability');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
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
      firstReason: (bar?.querySelector<HTMLElement>('.con-hand__reason--bar')?.innerText ?? '').replace(/\s+/g, ' ').trim(),
    };
  });
}

async function zoomAvailability(page: Page) {
  return await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('.con-zoom-sidecol .con-cardavail--panel');
    if (el === null) {
      return undefined;
    }
    const rules = document.querySelector<HTMLElement>('.con-zoom-rules__scroll .con-scroll__view') ??
      document.querySelector<HTMLElement>('.con-zoom-rules__scroll');
    return {
      severity: el.getAttribute('data-severity') ?? '',
      verdict: (el.querySelector<HTMLElement>('.con-cardavail__verdict')?.innerText ?? '').replace(/\s+/g, ' ').trim(),
      firstReason: (el.querySelector<HTMLElement>('.con-cardavail__reason .con-cardavail__text')?.innerText ?? '').replace(/\s+/g, ' ').trim(),
      rulesScrolls: rules !== null && rules.scrollHeight > rules.clientHeight + 1,
    };
  });
}

test.describe('card availability · hand ⇄ fullscreen', () => {
  test.use({
    viewport: {width: 3840, height: 2160},
    deviceScaleFactor: 1,
    screen: {width: 3840, height: 2160},
  });

  test('a requirement-blocked card reads the same in the verdict bar and the «ДОСТУПНОСТЬ» panel', async ({page, request}) => {
    test.setTimeout(300_000);

    const config = soloGameConfig({
      customProjectCards: CARDS,
      customCorporationsList: [CORP, 'Saturn Systems'],
    });
    const playerId = await createGameWithCards(request, [...CARDS, CORP], {config});
    await seedGameOverApi(request, playerId, {cards: CARDS, corporation: CORP});
    await openConsole(page, playerId, '&consoleProfile=tv');
    await waitForBoardHome(page, 25);
    await openHand(page);

    // ── 1 · Focus «Озеро Маринер» — sorted BEHIND the playable Comet
    //    (potential-first order), so it is the album's last card.
    for (let i = 0; i < 3; i++) {
      const v = await handVerdict(page);
      if (v.blocked) {
        break;
      }
      await press(page, 'ArrowRight', 700);
      await forceFrame(page);
    }
    const blockedVerdict = await handVerdict(page);
    console.log('[hand verdict]', JSON.stringify(blockedVerdict));
    expect(blockedVerdict.blocked, 'the requirement-blocked card wears the red verdict').toBeTruthy();
    expect(blockedVerdict.firstReason.length, 'the concrete server reason is on the bar').toBeGreaterThan(0);
    await shoot(page, '01-hand-blocked-verdict');

    // ── 2 · X-fullscreen: the «ДОСТУПНОСТЬ» panel below «ПРАВИЛА», same
    //    severity, same primary reason — ONE view-model, two densities.
    await openZoomForced(page);
    await page.waitForTimeout(1400);
    const panel = await zoomAvailability(page);
    console.log('[fullscreen availability]', JSON.stringify(panel));
    expect(panel, 'the availability panel joined the rules panel').toBeTruthy();
    expect(panel?.severity).toBe('blocked');
    expect(panel?.verdict.length, 'the big status headline reads').toBeGreaterThan(0);
    expect(panel?.firstReason, 'the SAME primary reason in both densities').toBe(blockedVerdict.firstReason);
    expect(await page.locator('.con-zoom-rules').count(), 'the rules panel stands beside it').toBe(1);
    expect(panel?.rulesScrolls, 'the availability panel never squeezes the rules into scroll').toBeFalsy();
    await shoot(page, '02-fullscreen-availability');
    await closeZoomForced(page);

    // ── 3 · The CONTROL: the playable Comet shows NO panel (and no empty box).
    for (let i = 0; i < 3; i++) {
      const v = await handVerdict(page);
      if (v.ok) {
        break;
      }
      await press(page, 'ArrowLeft', 700);
      await forceFrame(page);
    }
    const okVerdict = await handVerdict(page);
    console.log('[hand verdict ok]', JSON.stringify(okVerdict));
    expect(okVerdict.ok, 'the playable card wears the green verdict').toBeTruthy();
    await openZoomForced(page);
    await page.waitForTimeout(1200);
    const noPanel = await zoomAvailability(page);
    expect(noPanel, 'a playable card shows NO availability panel').toBeUndefined();
    await shoot(page, '03-fullscreen-playable-no-panel');
    await closeZoomForced(page);
  });
});
