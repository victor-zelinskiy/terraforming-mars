import {expect, Page, APIRequestContext} from '@playwright/test';
import {focusCard, press, soloGameConfig} from './consoleStart';

/**
 * THE TRADE'S SECOND DOOR — shared fixtures for the specs that drive a colony
 * trade entered from a CARD ACTION («Летающая платформа» → «Выбрать колонию»):
 * `console-card-trade-entry.spec.ts` (the door itself, pre-commit) and
 * `console-card-trade-resume.spec.ts` (the suspended deep chain: collapse →
 * fresh look → exact resume). One boot recipe and one keyboard route, so the
 * two specs can never drift onto different doors.
 */

export const LAUNCHPAD = 'Titan Floating Launch-pad';

/** A corporation that holds no floaters and has no Jovian tag — so the
 *  action's candidates are the card alone. */
export const TRADE_CORP = 'CrediCor';

/** Put the card on top of the deck and pin the calm corporation. */
export function cardTradeConfig(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return soloGameConfig({
    expansions: {colonies: true},
    customProjectCards: [LAUNCHPAD],
    customCorporationsList: [TRADE_CORP],
    ...extra,
  });
}

export const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
] as const;

/** The card's stored floaters — the SERVER's number, not the screen's. */
export async function floaters(request: APIRequestContext, playerId: string): Promise<number> {
  const res = await request.get(`/api/player?id=${playerId}`);
  const view = await res.json();
  const card = (view.thisPlayer.tableau ?? []).find((c: {name: string}) => c.name === LAUNCHPAD);
  return card?.resources ?? -1;
}

/** RT wheel → the hand, verified and settled. */
export async function openHand(page: Page, tries = 5): Promise<void> {
  const hand = page.locator('.con-hand');
  for (let i = 0; i < tries && await hand.count() === 0; i++) {
    await press(page, 'Period', 800);
    await press(page, 'Enter', 1600);
  }
  await expect(hand, 'the hand screen must open').toHaveCount(1, {timeout: 12_000});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 20_000});
}

/** Play the launch-pad all the way (it asks where its two floaters go). */
export async function playLaunchpad(page: Page): Promise<void> {
  await openHand(page);
  expect(await focusCard(page, LAUNCHPAD, 16), `${LAUNCHPAD} must be reachable in hand`).toBe(true);
  const composer = page.locator('.con-composer--play');
  for (let i = 0; i < 8 && await composer.count() === 0; i++) {
    await press(page, 'Enter', 1400);
  }
  await expect(composer).toHaveCount(1, {timeout: 8000});
  for (let i = 0; i < 8 && await composer.count() > 0; i++) {
    await press(page, 'Enter', 1500);
  }
  await expect(composer, `${LAUNCHPAD} must commit`).toHaveCount(0, {timeout: 25_000});
  await page.waitForTimeout(2500);
}

/**
 * Walk the BROWSE grid onto the card's SECOND printed row — «Потратьте 1
 * аэростат, чтобы бесплатно поторговать». Each printed action row is its own
 * tile («Вариант 1» / «Вариант 2»), so the trade branch is reached by choosing
 * the right TILE, not by moving inside the composer.
 */
export async function focusTradeVariantTile(page: Page, tries = 14): Promise<void> {
  // Ask the BROWSE DETAIL column, which names the variant the cursor is on —
  // the panel the player reads, not a grid class name.
  const variantNow = (): Promise<string> => page.evaluate(() =>
    (document.querySelector('.con-cardactions__detail-variant') as HTMLElement | null)
      ?.innerText.replace(/\s+/g, ' ').trim() ?? '');
  for (let i = 0; i < tries; i++) {
    if (/2\s*\/\s*2/.test(await variantNow())) {
      return;
    }
    await press(page, i % 2 === 0 ? 'ArrowRight' : 'ArrowDown', 500);
  }
  const tiles = await page.evaluate(() => Array.from(document.querySelectorAll('.con-cardactions__tile'))
    .map((t) => (t as HTMLElement).className));
  throw new Error(`the trade variant tile was never focused (detail=«${await variantNow()}» tiles=${JSON.stringify(tiles)})`);
}

/** RT wheel → the standalone «Колонии» section. */
export async function openColoniesSection(page: Page, tries = 4): Promise<void> {
  const colonies = page.locator('.con-colonies');
  for (let i = 0; i < tries && await colonies.count() === 0; i++) {
    await press(page, 'Period', 1100);
    await press(page, 'ArrowRight', 1300);
  }
  await expect(colonies, 'the colonies section must open').toHaveCount(1, {timeout: 10_000});
}

/**
 * THE FLEET DOCK's geometry, wherever it currently stands — the parity probe.
 * One reading works for BOTH entries because the dock is one component in one
 * header cell: the standalone «Колонии» header's trailing zone, or the hosted
 * berth teleported into the card-actions header's trailing zone.
 */
export type FleetGeo = {
  /** Every player chip's box (rounded px). */
  chips: Array<{w: number, h: number}>,
  /** All chips lie on ONE horizontal line (the vertical stack is the bug). */
  oneRow: boolean,
  /** Distance from the dock's right edge to the HEADER's right edge — the
   *  «right edge» half of spatial memory. */
  dockToHeadRight: number,
};

export async function fleetGeometry(page: Page): Promise<FleetGeo | null> {
  return page.evaluate(() => {
    const bar = document.querySelector('.con-colonies__fleetbar');
    const head = bar?.closest('.con-wshead') ?? null;
    if (bar === null || head === null) {
      return null;
    }
    const rects = Array.from(bar.querySelectorAll('.con-colonies__fleetchip'))
      .map((c) => c.getBoundingClientRect());
    if (rects.length === 0) {
      return null;
    }
    const tops = rects.map((r) => Math.round(r.top));
    return {
      chips: rects.map((r) => ({w: Math.round(r.width), h: Math.round(r.height)})),
      oneRow: Math.max(...tops) - Math.min(...tops) <= 3,
      dockToHeadRight: Math.round(
        head.getBoundingClientRect().right - Math.max(...rects.map((r) => r.right))),
    };
  });
}

/** Assert two dock readings are the SAME presentation (±1 px per box). */
export function expectFleetParity(hosted: FleetGeo | null, standalone: FleetGeo | null): void {
  expect(standalone, 'the standalone dock must be measurable').not.toBeNull();
  expect(hosted, 'the hosted dock must be measurable').not.toBeNull();
  expect(hosted?.oneRow, 'the hosted fleet chips must lie on ONE horizontal line').toBe(true);
  expect(standalone?.oneRow, 'the standalone fleet chips must lie on ONE horizontal line').toBe(true);
  expect(hosted?.chips.length, 'the same fleets are shown').toBe(standalone?.chips.length);
  hosted?.chips.forEach((chip, i) => {
    const twin = standalone?.chips[i];
    expect(Math.abs(chip.w - (twin?.w ?? 0)), `chip ${i} width parity (${chip.w} vs ${twin?.w})`).toBeLessThanOrEqual(1);
    expect(Math.abs(chip.h - (twin?.h ?? 0)), `chip ${i} height parity (${chip.h} vs ${twin?.h})`).toBeLessThanOrEqual(1);
  });
  expect(Math.abs((hosted?.dockToHeadRight ?? 0) - (standalone?.dockToHeadRight ?? 0)),
    'the dock hugs the same right edge in both entries').toBeLessThanOrEqual(24);
}
