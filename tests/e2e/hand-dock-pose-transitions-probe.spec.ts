import {test, expect, Page} from '@playwright/test';
import {bootIntoGame, press, soloGameConfig} from './consoleStart';

/**
 * DIAGNOSTIC (not a guard): record the hand dock's POSE TRANSITIONS as the
 * player's eye sees them — rest ↔ raised (RT wheel), rest ↔ compact (a
 * surface opens), raised → compact (wheel commit into a sheet), plus a fast
 * open/close flutter. Per-rAF numeric story (edge card rects → amplitude +
 * velocity profile) and static screenshots of the three poses.
 *
 * Run with `--trace on` and pull the screencast JPEGs for perceptual review.
 */

type Frame = {
  t: number,
  cls: string,
  n: number,
  // leftmost / middle / rightmost docked card: left x, top y, width, rotation-ish
  backs: Array<{x: number, y: number, w: number, h: number}>,
};

async function recordFrames(page: Page, ms: number): Promise<Array<Frame>> {
  return page.evaluate(async (budget) => {
    const out: Array<Frame> = [];
    const t0 = performance.now();
    const pick = () => {
      const backs = Array.from(document.querySelectorAll<HTMLElement>('[data-hand-dock-card]'))
        .filter((el) => (el.getAttribute('data-hand-body-mode') ?? 'docked') === 'docked');
      const idx = [0, Math.floor(backs.length / 2), backs.length - 1].filter((i) => i >= 0 && i < backs.length);
      return idx.map((i) => {
        const r = backs[i].getBoundingClientRect();
        return {
          x: Math.round(r.left * 10) / 10, y: Math.round(r.top * 10) / 10,
          w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10,
        };
      });
    };
    await new Promise<void>((resolve) => {
      const step = () => {
        const now = performance.now() - t0;
        const dock = document.querySelector<HTMLElement>('.con-handdock');
        out.push({
          t: Math.round(now),
          cls: dock === null ? '-' : [...dock.classList].filter((c) => c !== 'con-handdock').map((c) => c.replace('con-handdock--', '')).join(','),
          n: document.querySelectorAll('[data-hand-dock-card]').length,
          backs: pick(),
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

function logStory(label: string, frames: Array<Frame>): void {
  console.log(`=== ${label} ===`);
  for (const f of frames) {
    const b = f.backs.map((k) => `${k.x},${k.y} ${k.w}x${k.h}`).join(' | ');
    console.log(`t=${f.t} cls=[${f.cls}] :: ${b}`);
  }
  // The two invariants a pose ride owes on every frame: the sampler was
  // alive, and no card vanished/appeared mid-ride (the pack's population is
  // constant — poses re-seat the same bodies, never rebuild the fan).
  expect(frames.length, `${label}: sampler starved`).toBeGreaterThan(15);
  const counts = new Set(frames.map((f) => f.n));
  expect([...counts], `${label}: the docked population changed mid-ride`).toHaveLength(1);
}

async function shoot(page: Page, name: string): Promise<void> {
  await page.screenshot({path: `screenshots/hand-dock-pose/${name}.png`, clip: {x: 560, y: 640, width: 800, height: 440}});
}

test.describe('hand dock pose transitions probe', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

  test('record the pose transition story (13 cards)', async ({page, request}) => {
    test.setTimeout(420_000);
    await bootIntoGame(page, request, {
      buy: 13,
      config: soloGameConfig({
        players: [{name: 'PoseStory', color: 'red', beginner: false, handicap: 0, first: true}],
        customCorporationsList: ['CrediCor', 'Helion'],
      }),
    });
    await page.waitForTimeout(2500);
    await shoot(page, '1-rest');

    // rest → raised (RT wheel opens)
    let rec = recordFrames(page, 1100);
    await page.keyboard.press('Period');
    logStory('rest→raised (RT open)', await rec);
    await page.waitForTimeout(500);
    await shoot(page, '2-raised');

    // raised → rest (RT toggles the wheel closed)
    rec = recordFrames(page, 1100);
    await page.keyboard.press('Period');
    logStory('raised→rest (RT close)', await rec);
    await page.waitForTimeout(800);

    // rest → compact (the journal panel opens — a surface owns the screen)
    rec = recordFrames(page, 1200);
    await page.keyboard.press('KeyR');
    logStory('rest→compact (journal opens)', await rec);
    await page.waitForTimeout(600);
    await shoot(page, '3-compact');

    // compact → rest (journal closes)
    rec = recordFrames(page, 1200);
    await page.keyboard.press('Escape');
    logStory('compact→rest (journal closes)', await rec);
    await page.waitForTimeout(800);

    // FLUTTER: fast open/close/open/close of the RT wheel
    rec = recordFrames(page, 2600);
    await page.keyboard.press('Period');
    await page.waitForTimeout(200);
    await page.keyboard.press('Period');
    await page.waitForTimeout(280);
    await page.keyboard.press('Period');
    await page.waitForTimeout(200);
    await page.keyboard.press('Period');
    logStory('flutter (RT ×4)', await rec);
    await page.waitForTimeout(900);

    // raised → compact (wheel commit «Действия карт» → the sheet opens)
    await press(page, 'Period', 700);
    rec = recordFrames(page, 1400);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(120);
    await page.keyboard.press('Enter');
    logStory('raised→compact (wheel commit → sheet)', await rec);
    await page.waitForTimeout(700);
    await shoot(page, '4-sheet-compact');
    await press(page, 'Escape', 900);

    expect(true).toBe(true);
  });
});
