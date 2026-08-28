import {test, expect} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootToBoard, soloGameConfig} from './consoleStart';

/**
 * SCRATCH visual probe (not a committed guard): the МЕТКИ matrix's new
 * no-tags cell — does it mount, seat its medallion and leave the rail fitting?
 */
const OUT = path.resolve('screenshots', 'tagcell');

const PRESETS = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, dpr: 1, q: '&consoleProfile=auto'},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, dpr: 1, q: ''},
];

for (const preset of PRESETS) {
  test.describe(`tag matrix · ${preset.id}`, () => {
    test.use({viewport: preset.viewport, deviceScaleFactor: preset.dpr, screen: preset.viewport});

    test('the no-tags cell renders in the rail', async ({page, request}) => {
      test.setTimeout(420_000);
      fs.mkdirSync(OUT, {recursive: true});

      const created = await request.post('/api/creategame', {
        data: soloGameConfig({expansions: {venus: true, colonies: true}}),
      });
      expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
      const model = await created.json() as {players: Array<{id: string}>};

      await page.goto(`/player?id=${model.players[0].id}&console=1${preset.q}`);
      await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
      await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
      await bootToBoard(page);
      await page.waitForTimeout(2000);

      const cells = await page.$$eval('.con-tagmx__cell', (nodes) => nodes.map((n) => ({
        tag: n.getAttribute('data-tag-cell'),
        count: n.querySelector('.con-tagmx__num')?.textContent?.trim(),
        zero: n.classList.contains('con-tagmx__cell--zero'),
      })));
      const none = await page.$eval('[data-tag-cell="none"] .con-tagmx__medal', (n) => {
        const cs = getComputedStyle(n);
        const r = n.getBoundingClientRect();
        return {
          img: cs.backgroundImage, size: cs.backgroundSize,
          w: Math.round(r.width), h: Math.round(r.height),
        };
      });
      const rail = await page.$eval('.con-res', (n) => ({
        scrollH: n.scrollHeight, clientH: n.clientHeight,
      }));
      const mx = await page.$eval('.con-tagmx', (n) => {
        const r = n.getBoundingClientRect();
        return {b: Math.round(r.bottom), scrollH: n.scrollHeight, clientH: n.clientHeight};
      });
      // eslint-disable-next-line no-console
      console.log(`[${preset.id}] cells=${cells.length}`, JSON.stringify(cells));
      // eslint-disable-next-line no-console
      console.log(`[${preset.id}] none=`, JSON.stringify(none), 'rail=', JSON.stringify(rail), 'mx=', JSON.stringify(mx));

      await page.locator('.con-res').screenshot({path: path.join(OUT, `${preset.id}-rail.png`)});
      await page.screenshot({path: path.join(OUT, `${preset.id}-full.png`)});

      expect(cells.some((c) => c.tag === 'none')).toBeTruthy();
      expect(none.img).toContain('tag-none');
      expect(rail.scrollH).toBeLessThanOrEqual(rail.clientH + 1);
    });
  });
}
