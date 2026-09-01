import {test, expect, Page} from '@playwright/test';
import {bootIntoGame, soloGameConfig} from './consoleStart';

/**
 * DIAGNOSTIC (not a guard): full-resolution clip sequence of the dock zone
 * through the pose transitions — the perceptual half of the pose probe
 * (`hand-dock-pose-transitions-probe` records the numbers). Screenshots
 * force BeginFrames, so the ride is alive in headless while we sample it.
 */

/** POSE_VIEW=handheld|tv4k reruns the same capture on another profile. */
const VIEW = process.env.POSE_VIEW === 'handheld' ? {width: 1280, height: 800} :
  process.env.POSE_VIEW === 'tv4k' ? {width: 3840, height: 2160} :
    {width: 1920, height: 1080};
const TAG = process.env.POSE_VIEW ?? 'fhd';
const CLIP = {
  x: VIEW.width / 2 - VIEW.width * 0.157, y: VIEW.height - VIEW.height * 0.148,
  width: VIEW.width * 0.313, height: VIEW.height * 0.148,
};

async function burst(page: Page, tag: string, shots: number, gapMs: number): Promise<void> {
  const t0 = Date.now();
  for (let i = 0; i < shots; i++) {
    const rel = Date.now() - t0;
    await page.screenshot({
      path: `screenshots/hand-dock-pose/seq/${TAG}-${tag}-${String(rel).padStart(4, '0')}ms.png`,
      clip: CLIP,
    });
    await page.waitForTimeout(gapMs);
  }
}

test.describe('hand dock pose capture', () => {
  test.use({viewport: VIEW, deviceScaleFactor: 1});

  test('clip sequences of the pose rides (13 cards)', async ({page, request}) => {
    test.setTimeout(420_000);
    await bootIntoGame(page, request, {
      buy: process.env.POSE_BUY === undefined ? 13 : Number(process.env.POSE_BUY),
      config: soloGameConfig({
        players: [{name: 'PoseCap', color: 'red', beginner: false, handicap: 0, first: true}],
        customCorporationsList: ['CrediCor', 'Helion'],
      }),
    });
    await page.waitForTimeout(2500);

    await page.keyboard.press('KeyR'); // journal → rest→compact settle
    await burst(page, 'tuck', 10, 60);
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape'); // journal closes → compact→rest
    await burst(page, 'untuck', 10, 50);
    await page.waitForTimeout(700);
    await page.keyboard.press('Period'); // RT wheel → rest→raised
    await burst(page, 'ready', 10, 50);
    await page.waitForTimeout(500);
    await page.keyboard.press('Period');
    await page.waitForTimeout(1000);
    expect(true).toBe(true);
  });
});
