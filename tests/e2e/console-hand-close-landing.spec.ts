import {test, expect, Page} from '@playwright/test';
import {bootIntoGame, press, soloGameConfig, waitForTurn} from './consoleStart';

/**
 * THE HAND-CLOSE LANDING IS PIXEL-TRUE, IN THE DOCK'S FULL POSE.
 *
 * The close/collapse gather flies every card back into the dock, and the
 * handoff is the no-dip swap: the real back turns visible UNDER the still-
 * opaque proxy, which then fades ON TOP — so for that whole window BOTH
 * copies exist and one sampled frame gives the true overlay delta.
 *
 * THE BUG THIS PINS: the dock rests COMPACT while the album is open, and the
 * close targets used to be measured BEFORE the intake accent flipped the pack
 * FULL — the whole hand landed in the miniature pose and the real backs then
 * materialized full-size in one frame («карты прилетают в миниатюру и она
 * сразу стаёт обычной»). Now the accent begins before the measure and the
 * targets come from `landingRects` (resting — a running pose transition
 * un-maps to its full-pose destination), so proxy and back must overlay
 * within subpixel + one settle frame at every materialization.
 */

const GAME_CONFIG = soloGameConfig({
  players: [{name: 'CloseLanding', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.37,
});

type Overlay = {t: number, name: string, dx: number, dy: number, dw: number, compact: boolean, anim: string, tf: string};

async function installWatch(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__hcl?: {timer: number, samples: number, overlays: Array<Overlay>}};
    if (w.__hcl !== undefined) {
      clearInterval(w.__hcl.timer);
    }
    const state = {timer: 0, samples: 0, overlays: [] as Array<Overlay>};
    const t0 = performance.now();
    const scan = () => {
      state.samples++;
      const proxies = document.querySelectorAll<HTMLElement>('.con-handreveal-layer .con-deal-proxy[data-reveal-card]');
      if (proxies.length === 0) {
        return;
      }
      const dock = document.querySelector<HTMLElement>('.con-handdock');
      const compact = dock !== null && dock.classList.contains('con-handdock--compact');
      for (const proxy of proxies) {
        const name = proxy.getAttribute('data-reveal-card') ?? '';
        const back = document.querySelector<HTMLElement>(`[data-hand-dock-card="${CSS.escape(name)}"]`);
        if (back === null) {
          continue;
        }
        const bs = getComputedStyle(back);
        // The materialization window: the real back is VISIBLE while the
        // proxy still exists — the two must be one object.
        if (bs.visibility === 'hidden' || Number(bs.opacity) < 0.5) {
          continue;
        }
        const pr = proxy.getBoundingClientRect();
        const br = back.getBoundingClientRect();
        if (pr.width < 8 || br.width < 8) {
          continue;
        }
        // Compare CENTRES + width: the proxy's box is the natural card scaled
        // by transform, the back's is the pose-transformed slot — centre
        // alignment is the honest identity for two differently-anchored boxes.
        const dx = (pr.left + pr.width / 2) - (br.left + br.width / 2);
        const dy = (pr.top + pr.height / 2) - (br.top + br.height / 2);
        const dw = pr.width - br.width;
        if (state.overlays.length < 400) {
          const anims = (back as HTMLElement & {getAnimations?: () => Array<Animation>}).getAnimations?.() ?? [];
          state.overlays.push({
            t: Math.round(performance.now() - t0),
            name,
            dx: Math.round(dx * 100) / 100,
            dy: Math.round(dy * 100) / 100,
            dw: Math.round(dw * 100) / 100,
            compact,
            anim: anims.map((a) => `${(a as unknown as {transitionProperty?: string}).transitionProperty ?? (a as unknown as {animationName?: string}).animationName ?? '?'}:${a.playState}`).join('+') || '-',
            tf: bs.transform === 'none' ? 'none' : bs.transform.slice(0, 48),
          });
        }
      }
    };
    state.timer = window.setInterval(scan, 16) as unknown as number;
    new MutationObserver(scan).observe(document.body, {childList: true, subtree: true, attributes: true});
    w.__hcl = state as never;
    scan();
  });
}

test.describe('hand close landing · full-pose pixel-true handoff', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

  test('the gather lands every card on its full-pose berth (no miniature snap)', async ({page, request}) => {
    test.setTimeout(420_000);

    page.on('console', (m) => {
      if (m.text().includes('[hand-close')) {
        console.log(`PAGE: ${m.text()}`);
      }
    });
    await bootIntoGame(page, request, {
      buy: 6, // a real pack — the snap scales with the hand
      config: GAME_CONFIG,
    });
    await waitForTurn(page);
    await page.waitForTimeout(2500);
    await installWatch(page);

    // Two full open→close round trips (the second re-uses warmed poses).
    for (let i = 0; i < 2; i++) {
      await press(page, 'Period', 700); // RT wheel
      await press(page, 'Enter', 2400); // «КАРТЫ» — the open episode
      await press(page, 'Escape', 2600); // B — the close gather
      await page.waitForTimeout(600);
    }

    const probe = await page.evaluate(() => {
      const w = window as unknown as {__hcl: {timer: number, samples: number, overlays: Array<Overlay>}};
      window.clearInterval(w.__hcl.timer);
      return {samples: w.__hcl.samples, overlays: w.__hcl.overlays};
    });

    expect(probe.samples, 'the watch sampled the whole tour').toBeGreaterThan(300);
    // The no-dip handoff really happened (backs turn visible under proxies).
    expect(probe.overlays.length, 'no materialization overlay was ever witnessed').toBeGreaterThan(0);

    const bad = probe.overlays.filter((o) => Math.abs(o.dx) > 2.5 || Math.abs(o.dy) > 2.5 || Math.abs(o.dw) > 3);
    const story = bad.slice(0, 8)
      .map((o) => `t=${o.t} ${o.name}: Δ=${o.dx},${o.dy} Δw=${o.dw}${o.compact ? ' [compact!]' : ''} anim=${o.anim} tf=${o.tf}`)
      .join('\n  ');
    console.log(`[hand-close] overlays=${probe.overlays.length} worst=${probe.overlays.reduce((m, o) => Math.max(m, Math.abs(o.dx), Math.abs(o.dy)), 0).toFixed(2)}px`);
    expect(bad.length, `a card materialized off its proxy (the miniature-pose snap):\n  ${story}`).toBe(0);
  });
});
