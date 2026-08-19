import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  deploymentActive, focusCard, focusedCard, openConsole, press, soloGameConfig, stepKind,
  stepSubject, summaryVisible, visibleSurfaces, waitPressable,
} from './consoleStart';

/**
 * THE STARTING HAND'S REQUIREMENT HEAD-UP — the between-generation draft's
 * availability system, extended to the game's FIRST card decision.
 *
 * The buy step of the setup wizard is a pick FOR LATER exactly like a draft
 * pick, so it gets the SAME server reasons and the SAME shared block in the
 * SAME draft voice: amber «требование пока не выполнено» while the game can
 * still get there. What this spec exists to catch is not the wording (that is
 * unit-guarded in cardAvailability.spec.ts / consoleStartState.spec.ts) but
 * the two things only a real screen can answer:
 *
 *  1. the reserved TWO-ROW rail actually FITS its block (the rail clips —
 *     `overflow: hidden` — so a mis-sized reserve silently eats the reason
 *     line, which is the whole point of the feature);
 *  2. taking that height from the body does not push the card grid into the
 *     body's internal scroll (the fit engine must absorb it).
 *
 * Deliberately `testMode: false`: a test-mode deal is ~20 project cards, and
 * console fit must never be judged on a non-production deal (that mistake
 * once broke the real 4K TV outright). «Озеро Маринер» (0 °C at a −30 °C
 * table) is put on top of the project deck, so the production-sized 10-card
 * deal contains it without a re-roll loop.
 */

const OUT = path.join('screenshots', 'start-availability');
const CARD = 'Lake Marineris';

/** The couch profile is the product; FHD is where the taller rail costs most. */
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

/** The rail's block + the boxes that decide whether it is readable. */
async function railReadout(page: Page) {
  return await page.evaluate(() => {
    const rail = document.querySelector<HTMLElement>('.con-start__statusrail');
    const block = document.querySelector<HTMLElement>('.con-start__statusrail .con-cardavail');
    const line = block?.querySelector<HTMLElement>('.con-cardavail__line');
    const body = document.querySelector<HTMLElement>('.con-start__body--cards');
    const box = (el: HTMLElement | null | undefined) => (el === null || el === undefined) ? undefined : (() => {
      const r = el.getBoundingClientRect();
      return {top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height)};
    })();
    return {
      reserved: rail?.classList.contains('con-start__statusrail--avail') ?? false,
      severity: block?.getAttribute('data-severity') ?? '',
      name: (block?.querySelector<HTMLElement>('.con-cardavail__name')?.innerText ?? '').trim(),
      status: (block?.querySelector<HTMLElement>('.con-cardavail__status')?.innerText ?? '').replace(/\s+/g, ' ').trim(),
      reason: (line?.innerText ?? '').replace(/\s+/g, ' ').trim(),
      rail: box(rail),
      block: box(block),
      bodyOverflow: body === null ? 0 : body.scrollHeight - body.clientHeight,
    };
  });
}

/** The fullscreen viewer's availability aside (the shared panel density). */
async function zoomAvailability(page: Page) {
  return await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('.con-zoom-sidecol .con-cardavail--panel');
    return el === null ? undefined : {
      severity: el.getAttribute('data-severity') ?? '',
      verdict: (el.querySelector<HTMLElement>('.con-cardavail__verdict')?.innerText ?? '').replace(/\s+/g, ' ').trim(),
      reasons: Array.from(el.querySelectorAll<HTMLElement>('.con-cardavail__reason .con-cardavail__text'))
        .map((r) => r.innerText.replace(/\s+/g, ' ').trim()),
    };
  });
}

test.describe.configure({mode: 'serial'});

for (const preset of PRESETS) {
  test(`${preset.tag}: the initial buy states its requirements — reserved rail, fullscreen panel`, async ({page, request}) => {
    test.setTimeout(240_000);
    await page.setViewportSize({width: preset.width, height: preset.height});

    const created = await request.post('/api/creategame', {
      data: soloGameConfig({testMode: false, customProjectCards: [CARD]}),
    });
    expect(created.ok(), 'the game server accepted the config').toBeTruthy();
    const {players} = await created.json();
    await openConsole(page, players[0].id, preset.query);

    // Walk to the BUY step and STOP there. Two consoleStart traps decide the
    // shape of this loop: «A» on a single-pick step already advances (so a
    // blind Enter+RT skips a step), and the SUMMARY answers `stepKind` with
    // its own word while «A» there SUBMITS the setup — one round too many and
    // the probe is standing in the deployment, whose crumb still reads
    // «ПРОЕКТЫ › ПОКУПКА». So: press, look, and only push RT if nothing moved.
    await page.waitForSelector('.con-start__frame', {timeout: 45_000});
    for (let round = 0; round < 8; round++) {
      if (await summaryVisible(page) || await deploymentActive(page)) {
        break; // gone past the buy — the assertion below reports it honestly
      }
      if (stepKind(await stepSubject(page)) === 'project') {
        break;
      }
      await waitPressable(page);
      await page.waitForTimeout(300);
      const before = await stepSubject(page);
      await press(page, 'Enter', 800); // one corporation / one CEO — nothing else
      if (await stepSubject(page) === before && !(await summaryVisible(page))) {
        await press(page, 'Period', 1500); // RT: advance with the physical collect
      }
      for (let w = 0; w < 12 && await stepSubject(page) === before && !(await summaryVisible(page)); w++) {
        await page.waitForTimeout(250);
      }
    }
    expect(stepKind(await stepSubject(page)) === 'project' && !(await deploymentActive(page)),
      `the wizard stopped on the project buy — showing ${JSON.stringify(await visibleSurfaces(page))}`).toBeTruthy();
    await waitPressable(page);
    await page.waitForTimeout(400);

    expect(await focusCard(page, CARD), `«${CARD}» was dealt and could be focused`).toBeTruthy();
    expect(await focusedCard(page)).toBe(CARD);
    await forceFrame(page);

    const rail = await railReadout(page);
    await shoot(page, preset.tag, 'projects-rail');
    // The card is bought for LATER, so the verdict is the amber PENDING one —
    // never the play voice's red «нельзя разыграть», never a money line.
    expect(rail.reserved, `the step reserved the two-row availability zone — ${JSON.stringify(rail)}`).toBeTruthy();
    expect(rail.severity, 'pending, not missed: 0 °C is still reachable').toBe('pending');
    expect(rail.name.length, 'the block carries the focused card name').toBeGreaterThan(0);
    expect(rail.status.length, 'the loud status stands beside it').toBeGreaterThan(0);
    expect(rail.reason, 'the requirement-vs-now line is the second row').toMatch(/-?\d/);
    // 1. The rail CLIPS — the block must fit inside it, whole.
    expect(rail.block!.top, 'the block starts inside the rail').toBeGreaterThanOrEqual(rail.rail!.top - 1);
    expect(rail.block!.bottom, 'the reason line is not clipped away').toBeLessThanOrEqual(rail.rail!.bottom + 1);
    // 2. …and the height it took did not push the grid into a scroll.
    expect(rail.bodyOverflow, 'the card grid still fits the shortened body').toBeLessThanOrEqual(2);

    // The fullscreen viewer speaks the same voice, one level deeper.
    const zoom = page.locator('dialog.con-zoom[open]');
    for (let i = 0; i < 10 && await zoom.count() === 0; i++) {
      await press(page, 'KeyX', 900);
      await forceFrame(page);
    }
    await expect(zoom, 'the fullscreen viewer opened').toHaveCount(1, {timeout: 8_000});
    await page.waitForTimeout(1300);
    await forceFrame(page);
    const panel = await zoomAvailability(page);
    await shoot(page, preset.tag, 'projects-zoom');
    expect(panel, 'the viewer shows the availability aside').toBeDefined();
    expect(panel!.severity, 'the same verdict as the rail — one model, two densities').toBe('pending');
    expect(panel!.reasons.length, 'and the reason list under it').toBeGreaterThan(0);
  });
}
