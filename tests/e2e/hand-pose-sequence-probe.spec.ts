import {test, expect, Page} from './consoleTest';
import {bootIntoGame, press, settle, soloGameConfig, waitForTurn} from './consoleStart';
import {armWitness, pageNow, Witness} from './witness';

/**
 * DIAGNOSTIC (not a guard): record the dock pack's pose story around the hand-open press — root classes, the
 * first/middle/last back's rect + computed transform, back visibility, proxy count — to see EXACTLY what the player's
 * eye sees at the static→flight boundary. RECORDED (FLAKE ZERO — `armWitness`, armed before the press): every pose the
 * product writes, with the page's time, off its own writes and a frame tick — never a sampler of our own.
 */

type Pose = {
  cls: string,
  backs: Array<{x: number, y: number, w: number, vis: boolean, tf: string}>,
  proxies: number,
  pagerOp: string,
};
type Frame = Pose & {t: number};

const POSE_WITNESS = 'hand-pose-sequence';

async function armPose(page: Page): Promise<Witness<Pose>> {
  return armWitness<Pose>(page, POSE_WITNESS, () => {
    const backs = Array.from(document.querySelectorAll<HTMLElement>('[data-hand-dock-card]'));
    const idx = [0, Math.floor(backs.length / 2), backs.length - 1].filter((i) => i >= 0 && i < backs.length);
    const dock = document.querySelector<HTMLElement>('.con-handdock');
    const pager = document.querySelector<HTMLElement>('.con-handdock__pager');
    return {
      cls: dock === null ? '-' : [...dock.classList].filter((c) => c !== 'con-handdock').map((c) => c.replace('con-handdock--', '')).join(','),
      backs: idx.map((i) => {
        const el = backs[i];
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          x: Math.round(r.left * 10) / 10, y: Math.round(r.top * 10) / 10, w: Math.round(r.width * 10) / 10,
          vis: cs.visibility !== 'hidden',
          tf: cs.transform === 'none' ? 'none' : cs.transform.replace('matrix(', '').slice(0, 44),
        };
      }),
      proxies: document.querySelectorAll('.con-handreveal-layer [data-reveal-card]').length,
      pagerOp: pager === null ? '-' : getComputedStyle(pager).opacity,
    };
  });
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
    // The board at rest before the wheel (a STATE — holds, the transport, finite motion), never a fixed 2 s.
    await settle(page);

    await press(page, 'Period', 900); // RT wheel → the pack goes RAISED
    const pose = await armPose(page);
    const t0 = await pageNow(page);
    await page.keyboard.press('Enter'); // «КАРТЫ» — the open press
    // The recording runs to the END STATE of the open (not a fixed 1.4 s): the album stands and no card is in the air.
    // A diagnostic, not a guard — an open that never ends is printed (the frames say how far it got), never a red.
    const opened = await expect(page.locator('.con-hand')).toHaveCount(1, {timeout: 30_000}).then(() => true, () => false);
    const landed = await expect(page.locator('.con-handreveal-layer [data-reveal-card]')).toHaveCount(0, {timeout: 30_000}).then(() => true, () => false);
    console.log(`[hand-pose] the open's end state: album ${opened ? 'open' : 'NEVER OPENED'}, flight ${landed ? 'over' : 'STILL IN THE AIR'}`);
    await settle(page);
    const frames: Array<Frame> = (await pose.stop()).map((s) => ({...s.v, t: s.t - t0}));
    await press(page, 'Escape', 2800);

    for (const f of frames) {
      const b = f.backs.map((k) => `${k.vis ? '' : 'HID '}${k.x},${k.y} w${k.w} [${k.tf}]`).join(' | ');
      console.log(`t=${f.t} cls=${f.cls} prox=${f.proxies} pager=${f.pagerOp} :: ${b}`);
    }
    // The recorder's liveness only (a dead recorder records nothing) — a count of samples is a count of frames.
    expect(frames.length).toBeGreaterThan(0);
  });
});
