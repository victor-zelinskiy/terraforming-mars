/**
 * P44 · ledger ER — THE CREATOR'S MAP SHOWCASE (the owner: «экран выбора карты сделан криво… карта выбора может уйти
 * за контекст экрана; навигация по d-pad работает криво; стоит рассмотреть структуру вроде СЕТКИ, а не просто ряд»).
 *
 * The «Карта» deck is a GRID solved from the measured stage (`mapGridPlan`), the d-pad the lobby's (`showcaseStep`):
 *  · every map of the page stands INSIDE the stage, and the cursored map is fully inside it on EVERY step of a walk
 *    (◀ ×12 · ▶ ×12 · ▲ ▼) — the carousel parked the cursor ~2560 px past the edge at Hollandia;
 *  · ◀ ▶ walk the ring (wrapping), ▲ ▼ a row with a wall;
 *  · A selects: «ТЕКУЩАЯ» moves to the cursored map (a kant, never a halo);
 *  · the dossier follows the cursor (wide creator); the fan boards say «ФАН»;
 *  · the Deck PAGES (a spine «N / M»), never a scroll.
 * Two profiles on purpose: the Deck's pagination is a profile-specific number (tests.md § TV only).
 */
import {test, expect, Page} from './consoleTest';
import {press} from './consoleStart';
import {campaignBase, seedIdentity} from './campaignFixtures';

const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;

async function openMapDeck(page: Page, query: string): Promise<void> {
  await seedIdentity(page, 'Alice');
  await page.goto(`${campaignBase()}/?x=1${query}`);
  await page.waitForSelector('.cm-menu__items', {timeout: 60_000});
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 60_000}).catch(() => undefined);
  for (let i = 0; i < 12; i++) {
    if (await page.locator('.cm-item--cursor').getAttribute('data-menu-item') === 'create') {
      break;
    }
    await press(page, 'ArrowDown', 120);
  }
  await expect(page.locator('.cm-item--cursor')).toHaveAttribute('data-menu-item', 'create');
  await press(page, 'Enter', 400);
  await page.waitForSelector('.cm-mode__tile', {timeout: 30_000});
  await press(page, 'Enter', 600); // «Отдельная партия»
  await page.waitForSelector('.cm-crew', {timeout: 30_000});
  for (let i = 0; i < 6 && await page.locator('[data-map-showcase]').count() === 0; i++) {
    await press(page, 'KeyE', 500); // RB → the next deck
  }
  await page.waitForSelector('[data-map-showcase]', {timeout: 15_000});
}

/** The cursored tile against the stage: fully inside (a 4 % allowance for the cursor's lift), and its index. */
async function cursorInside(page: Page): Promise<{index: number, inside: boolean, rect: string}> {
  return page.evaluate(() => {
    const stage = document.querySelector('.cm-maps__stage')!.getBoundingClientRect();
    const tile = document.querySelector<HTMLElement>('.cm-map--cursor');
    if (tile === null) {
      return {index: -1, inside: false, rect: 'no cursor'};
    }
    const r = tile.getBoundingClientRect();
    const tol = 0.04 * stage.height;
    const inside = r.left >= stage.left - tol && r.right <= stage.right + tol && r.top >= stage.top - tol && r.bottom <= stage.bottom + tol;
    return {index: Number(tile.dataset.mapIndex), inside, rect: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)} in ${Math.round(stage.left)},${Math.round(stage.top)} ${Math.round(stage.width)}×${Math.round(stage.height)}`};
  });
}

for (const preset of PRESETS) {
  test.describe(`P44 · the creator's map showcase · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`the grid holds every map inside the stage, the cursor never leaves it, A moves «ТЕКУЩАЯ» (${preset.id})`, async ({page}) => {
      test.setTimeout(240_000);
      await openMapDeck(page, preset.query);
      const showcase = page.locator('[data-map-showcase]');
      const cols = Number(await showcase.getAttribute('data-map-cols'));
      const pages = Number(await showcase.getAttribute('data-map-pages'));
      if (preset.id === 'tv4k') {
        expect([cols, Number(await showcase.getAttribute('data-map-rows')), pages], 'one page of 4 × 3').toEqual([4, 3, 1]);
        await expect(page.locator('.cm-map')).toHaveCount(11);
        await expect(page.locator('[data-map-dossier]')).toBeVisible();
        await expect(page.locator('[data-map-tile="vastitas borealis"] [data-map-fan], [data-map-tile="amazonis p."] [data-map-fan]')).toHaveCount(2);
      } else {
        expect(pages, 'the Deck pages').toBeGreaterThan(1);
        await expect(page.locator('[data-map-spine]')).toBeVisible();
      }
      await page.screenshot({path: `screenshots/create-map-grid/${preset.id}/grid.png`});

      // THE WALK — the cursored map is inside the stage on EVERY step.
      const trail: Array<string> = [];
      const walk = async (key: string, n: number) => {
        for (let i = 0; i < n; i++) {
          await press(page, key, 150);
          const at = await cursorInside(page);
          trail.push(`${key}→${at.index}`);
          expect(at.inside, `after ${trail.join(' ')}: ${at.rect}`).toBe(true);
        }
      };
      await walk('ArrowRight', 12);
      expect((await cursorInside(page)).index, '▶ ×12 over eleven maps wraps the ring once').toBe(1);
      await walk('ArrowLeft', 12);
      expect((await cursorInside(page)).index).toBe(0);
      await walk('ArrowDown', 3);
      await walk('ArrowUp', 3);
      expect((await cursorInside(page)).index, '▲ from the top row is a wall').toBe(0);

      // A selects — «ТЕКУЩАЯ» moves to the cursored map.
      await walk('ArrowRight', 2);
      const target = await page.locator('.cm-map--cursor').getAttribute('data-map-tile');
      await press(page, 'Enter', 400);
      await expect(page.locator(`[data-map-tile="${target}"] [data-map-current]`)).toHaveCount(1);
      await expect(page.locator('[data-map-current]')).toHaveCount(1);
      // A standing state is a KANT — no blurred halo on the current map.
      const halo = await page.locator(`[data-map-tile="${target}"]`).evaluate((el) => /\b0px 0px \d+(\.\d+)?px/.test(getComputedStyle(el).boxShadow.replace(/inset[^,]*,?/g, '')));
      expect(halo, 'the current map wears a kant, never a halo').toBe(false);
      await page.screenshot({path: `screenshots/create-map-grid/${preset.id}/selected.png`});
    });
  });
}
