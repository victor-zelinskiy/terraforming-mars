import {test, expect, Page} from '@playwright/test';
import {bootIntoGame, press, soloGameConfig, waitForTurn} from './consoleStart';

/**
 * DIAGNOSTIC (not a guard): record, per rAF frame, the dock pack's pose
 * story around the hand-open press — root classes, the first/middle/last
 * back's rect + computed transform, back visibility, proxy count — to see
 * EXACTLY what the player's eye sees at the static→flight boundary.
 */

type Frame = {
  t: number,
  cls: string,
  backs: Array<{x: number, y: number, w: number, vis: boolean, tf: string}>,
  proxies: number,
  pagerOp: string,
};

async function recordPose(page: Page, ms: number): Promise<Array<Frame>> {
  return page.evaluate(async (budget) => {
    const out: Array<Frame> = [];
    const t0 = performance.now();
    const pick = () => {
      const backs = Array.from(document.querySelectorAll<HTMLElement>('[data-hand-dock-card]'));
      const idx = [0, Math.floor(backs.length / 2), backs.length - 1].filter((i) => i >= 0 && i < backs.length);
      return idx.map((i) => {
        const el = backs[i];
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          x: Math.round(r.left * 10) / 10, y: Math.round(r.top * 10) / 10, w: Math.round(r.width * 10) / 10,
          vis: cs.visibility !== 'hidden',
          tf: cs.transform === 'none' ? 'none' : cs.transform.replace(/matrix\(/, '').slice(0, 44),
        };
      });
    };
    await new Promise<void>((resolve) => {
      const step = () => {
        const now = performance.now() - t0;
        const dock = document.querySelector<HTMLElement>('.con-handdock');
        const pager = document.querySelector<HTMLElement>('.con-handdock__pager');
        out.push({
          t: Math.round(now),
          cls: dock === null ? '-' : [...dock.classList].filter((c) => c !== 'con-handdock').map((c) => c.replace('con-handdock--', '')).join(','),
          backs: pick(),
          proxies: document.querySelectorAll('.con-handreveal-layer [data-reveal-card]').length,
          pagerOp: pager === null ? '-' : getComputedStyle(pager).opacity,
        });
        if (now < budget) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
    return out;
  }, ms);
}

test.describe('hand pose sequence probe', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

  test('record the press → flight pose story (20 cards)', async ({page, request}) => {
    test.setTimeout(420_000);
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('tm_console_album', 'large');
      } catch { /* fine */ }
    });
    await bootIntoGame(page, request, {
      buy: 20,
      config: soloGameConfig({
        players: [{name: 'PoseSeq', color: 'red', beginner: false, handicap: 0, first: true}],
        seed: 0.47,
      }),
    });
    await waitForTurn(page);
    await page.waitForTimeout(2000);

    await press(page, 'Period', 900); // RT wheel → the pack goes RAISED
    const recording = recordPose(page, 1400);
    await page.keyboard.press('Enter'); // «КАРТЫ» — the open press
    const frames = await recording;
    await page.waitForTimeout(2200);
    await press(page, 'Escape', 2800);

    for (const f of frames) {
      const b = f.backs.map((k) => `${k.vis ? '' : 'HID '}${k.x},${k.y} w${k.w} [${k.tf}]`).join(' | ');
      console.log(`t=${f.t} cls=${f.cls} prox=${f.proxies} pager=${f.pagerOp} :: ${b}`);
    }
    expect(frames.length).toBeGreaterThan(20);
  });
});
