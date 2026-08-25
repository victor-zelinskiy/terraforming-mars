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

    // MID-OPEN CANCELS: B lands while the open episode is still flying —
    // the rewind must land on LIVE berths too (the reversed timeline flies
    // to its launch snapshot; the corrective final approach + the cancel
    // accent are what this pins). Three cancel points: early, mid, late.
    for (const cancelAt of [220, 420, 650]) {
      await press(page, 'Period', 700); // RT wheel
      await press(page, 'Enter', cancelAt); // the open starts…
      await press(page, 'Escape', 2400); // …and B cancels it mid-flight
      await page.waitForTimeout(500);
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

/**
 * THE ALBUM'S PACKET PHYSICS («Крупные карты», a big hand). With 4 cards per
 * page most of the hand lives as page PACKETS beyond the stage edges, and
 * this scenario is where the old episode fell apart: the off-window tail was
 * SAMPLED down to 8 proxies (cards vanished in one frame at the open) and
 * the rest alpha-dissolved mid-air toward off-screen anchors — then popped
 * from nowhere at the close materialization. Three detectors:
 *  · ACCOUNTING — the first flight frame carries ONE BODY PER CARD;
 *  · NO GHOSTS — no proxy is mid-fade while inside the album stage;
 *  · NO «ИЗ ВОЗДУХА» — a dock back may only materialize where its proxy
 *    was seen moments before.
 */
test.describe('hand album packet physics · large layout, big hand', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

  test('every card keeps a body through open and close (no vanish, no ghosts)', async ({page, request}) => {
    test.setTimeout(420_000);
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('tm_console_album', 'large');
      } catch {
        /* storage unavailable — the adaptive layout still exercises packets */
      }
    });
    await bootIntoGame(page, request, {
      buy: 10, // a packet-dominated hand: 4 visible, the rest parked as packets
      config: soloGameConfig({
        players: [{name: 'PacketPhysics', color: 'red', beginner: false, handicap: 0, first: true}],
        seed: 0.41,
      }),
    });
    await waitForTurn(page);
    await page.waitForTimeout(2500);

    await page.evaluate(() => {
      type St = {
        timer: number, samples: number, universe: number, firstProxies: number,
        ghosts: Array<string>, airborn: Array<string>, overlays: number, worst: number,
        lastSeen: Record<string, number>, backVis: Record<string, boolean>,
        lastBox?: {left: number, right: number, top: number, bottom: number},
      };
      const w = window as unknown as {__pp?: St};
      const st: St = {
        timer: 0, samples: 0, universe: 0, firstProxies: 0,
        ghosts: [], airborn: [], overlays: 0, worst: 0, lastSeen: {}, backVis: {},
      };
      const backs = () => Array.from(document.querySelectorAll<HTMLElement>('[data-hand-dock-card]'))
        .filter((b) => {
          const r = b.getBoundingClientRect();
          const cs = getComputedStyle(b);
          return r.width > 8 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.5;
        });
      st.universe = backs().length;
      const scan = () => {
        st.samples++;
        const now = performance.now();
        const proxies = Array.from(document.querySelectorAll<HTMLElement>('.con-handreveal-layer .con-deal-proxy[data-reveal-card]'));
        const hand = document.querySelector<HTMLElement>('.con-hand');
        if (hand !== null) {
          const hb = hand.getBoundingClientRect();
          if (hb.width > 100) {
            st.lastBox = {left: hb.left, right: hb.right, top: hb.top, bottom: hb.bottom};
          }
        }
        if (proxies.length > 0 && st.firstProxies === 0) {
          st.firstProxies = proxies.length;
        }
        for (const proxy of proxies) {
          const name = proxy.getAttribute('data-reveal-card') ?? '';
          st.lastSeen[name] = now;
          const op = Number(getComputedStyle(proxy).opacity);
          const pr = proxy.getBoundingClientRect();
          // GHOST: a half-transparent card with NO visible twin underneath —
          // a card genuinely dissolving into a hole. The no-dip teardown fade
          // (proxy fading ON TOP of its already-visible back/slot) is legit.
          const box = st.lastBox;
          if (op > 0.05 && op < 0.92 && box !== undefined && pr.width > 8 &&
              pr.right > box.left && pr.left < box.right && pr.bottom > box.top && pr.top < box.bottom - 40) {
            const twinBack = document.querySelector<HTMLElement>('[data-hand-dock-card="' + CSS.escape(name) + '"]');
            const twinSlot = document.querySelector<HTMLElement>('[data-zoom-slot="' + CSS.escape(name) + '"]');
            const visibleTwin = [twinBack, twinSlot].some((t) => {
              if (t === null) {
                return false;
              }
              const cs = getComputedStyle(t);
              return t.getBoundingClientRect().width > 8 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.5;
            });
            if (!visibleTwin && st.ghosts.length < 8) {
              st.ghosts.push(name + '@op=' + op.toFixed(2));
            }
          }
          // The overlay witness (proxy vs its materialized back).
          const back = document.querySelector<HTMLElement>('[data-hand-dock-card="' + CSS.escape(name) + '"]');
          if (back !== null) {
            const bs = getComputedStyle(back);
            if (bs.visibility !== 'hidden' && Number(bs.opacity) > 0.5) {
              const br = back.getBoundingClientRect();
              if (br.width > 8 && pr.width > 8) {
                st.overlays++;
                const dx = (pr.left + pr.width / 2) - (br.left + br.width / 2);
                const dy = (pr.top + pr.height / 2) - (br.top + br.height / 2);
                st.worst = Math.max(st.worst, Math.abs(dx), Math.abs(dy));
              }
            }
          }
        }
        // «ИЗ ВОЗДУХА»: a back that turns visible with no proxy history.
        const episodeLive = proxies.length > 0;
        for (const b of Array.from(document.querySelectorAll<HTMLElement>('[data-hand-dock-card]'))) {
          const name = b.getAttribute('data-hand-dock-card') ?? '';
          const cs = getComputedStyle(b);
          const vis = b.getBoundingClientRect().width > 8 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.5;
          const was = st.backVis[name] === true;
          if (vis && !was && episodeLive) {
            const seen = st.lastSeen[name];
            if (seen === undefined || now - seen > 450) {
              if (st.airborn.length < 8) {
                st.airborn.push(name + '@gap=' + (seen === undefined ? 'never' : String(Math.round(now - seen))));
              }
            }
          }
          st.backVis[name] = vis;
        }
      };
      st.timer = window.setInterval(scan, 16) as unknown as number;
      new MutationObserver(scan).observe(document.body, {childList: true, subtree: true, attributes: true});
      w.__pp = st;
      scan();
    });

    // Open → close, twice (the second run re-uses warmed poses/packets).
    for (let i = 0; i < 2; i++) {
      await press(page, 'Period', 700); // RT wheel
      await press(page, 'Enter', 2600); // «КАРТЫ» — the open episode
      await press(page, 'Escape', 2800); // B — the close gather
      await page.waitForTimeout(700);
    }

    const pp = await page.evaluate(() => {
      const w = window as unknown as {__pp: {timer: number, samples: number, universe: number, firstProxies: number, ghosts: Array<string>, airborn: Array<string>, overlays: number, worst: number}};
      window.clearInterval(w.__pp.timer);
      const {samples, universe, firstProxies, ghosts, airborn, overlays, worst} = w.__pp;
      return {samples, universe, firstProxies, ghosts, airborn, overlays, worst: Math.round(worst * 100) / 100};
    });
    console.log('[packet-physics]', JSON.stringify(pp));
    expect(pp.samples, 'the watch sampled the tours').toBeGreaterThan(200);
    expect(pp.universe, 'a packet-dominated hand stood in the dock').toBeGreaterThanOrEqual(9);
    // ONE BODY PER CARD from the first flight frame — the sampling cap's
    // one-frame vanish is dead. (>= : dockExtraLift may add airborne extras.)
    expect(pp.firstProxies, 'every card flies (universe=' + pp.universe + ')').toBeGreaterThanOrEqual(pp.universe);
    expect(pp.ghosts, 'no card is mid-dissolve inside the stage').toEqual([]);
    expect(pp.airborn, 'no dock back materializes without its proxy nearby').toEqual([]);
    expect(pp.overlays, 'the materialization overlay was witnessed').toBeGreaterThan(0);
    expect(pp.worst, 'landings stay pixel-true in the large layout too').toBeLessThanOrEqual(3);
  });
});
