import {test, expect, Page} from '@playwright/test';
import {bootIntoGame, press, soloGameConfig, waitForTurn} from './consoleStart';

/**
 * THE HAND-CLOSE LANDING IS PIXEL-TRUE, IN THE DOCK'S FULL POSE.
 *
 * Single-owner edition: there is no proxy/back pair any more — the SAME
 * body element flies home and simply stops being episode-owned
 * (`data-reveal-card` drops). The materialization-overlay watch of the old
 * two-element architecture is therefore unexpressible; what remains of the
 * claim is its OBSERVABLE half:
 *
 *  · THE LANDING POSE IS THE SETTLED POSE — the pack's card widths at the
 *    frame the episode releases must equal the widths after the dock has
 *    fully settled («карты прилетают в миниатюру и она сразу стаёт
 *    обычной» was exactly a scale mismatch between those two frames);
 *  · positions may drift only by the pose ride's own smoothing (a bounded
 *    reconcile), never re-seat across the tray.
 */

const GAME_CONFIG = soloGameConfig({
  players: [{name: 'CloseLanding', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.37,
});

type PoseFrame = {t: number, fly: number, widths: Array<number>};

async function installWatch(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__hcl?: {timer: number, samples: number, frames: Array<PoseFrame>}};
    if (w.__hcl !== undefined) {
      clearInterval(w.__hcl.timer);
    }
    const state = {timer: 0, samples: 0, frames: [] as Array<PoseFrame>};
    const t0 = performance.now();
    const scan = () => {
      state.samples++;
      if (state.frames.length >= 6000) {
        return;
      }
      const fly = document.querySelectorAll('.con-handreveal-layer [data-reveal-card]').length;
      const widths: Array<number> = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('.con-handbody[data-hand-body-mode="docked"]'))) {
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.5) {
          continue;
        }
        const r = el.getBoundingClientRect();
        if (r.width > 8) {
          widths.push(Math.round(r.width * 10) / 10);
        }
      }
      widths.sort((a, b) => a - b);
      state.frames.push({t: Math.round(performance.now() - t0), fly, widths});
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
      const w = window as unknown as {__hcl: {timer: number, samples: number, frames: Array<PoseFrame>}};
      window.clearInterval(w.__hcl.timer);
      return {samples: w.__hcl.samples, frames: w.__hcl.frames};
    });

    expect(probe.samples, 'the watch sampled the whole tour').toBeGreaterThan(300);

    // RELEASE EDGES: the frames where an episode let its bodies go (flying
    // dropped to zero). At each edge with a standing pack, the card widths
    // must MATCH the settled widths ≥700ms later — a mismatch is exactly the
    // «прилетели в миниатюру, затем стали обычными» scale snap.
    const edges: Array<{at: number, release: PoseFrame, settled: PoseFrame}> = [];
    for (let i = 1; i < probe.frames.length; i++) {
      if (probe.frames[i - 1].fly > 0 && probe.frames[i].fly === 0) {
        const release = probe.frames[i];
        const settled = probe.frames.find((f, j) => j > i && f.fly === 0 && f.t >= release.t + 700 &&
          // …still quiet: no new episode started between release and settle.
          probe.frames.slice(i, j).every((g) => g.fly === 0));
        if (settled !== undefined) {
          edges.push({at: release.t, release, settled});
        }
      }
    }
    expect(edges.length, 'the tour witnessed settled release edges').toBeGreaterThanOrEqual(2);

    const bad: Array<string> = [];
    for (const e of edges) {
      if (e.release.widths.length === 0) {
        continue; // an open's release — the pack is legitimately empty
      }
      if (e.release.widths.length !== e.settled.widths.length) {
        bad.push(`t=${e.at}: pack count changed ${e.release.widths.length} -> ${e.settled.widths.length}`);
        continue;
      }
      for (let k = 0; k < e.release.widths.length; k++) {
        // RELATIVE tolerance, by the defect's own magnitude: the miniature
        // snap was the COMPACT pose (scale 0.7 → −30-43% width), while a
        // mid-open cancel legitimately releases a card a few percent into
        // its flight scale and the layer's reconcile tween heals it
        // smoothly (measured ≤5%). 12% separates the two classes cleanly.
        const ref = Math.max(e.settled.widths[k], 1);
        if (Math.abs(e.release.widths[k] - e.settled.widths[k]) / ref > 0.12) {
          bad.push(`t=${e.at}: width[${k}] ${e.release.widths[k]} -> ${e.settled.widths[k]} (landing pose ≠ settled pose)`);
          break;
        }
      }
    }
    const closes = edges.filter((e) => e.release.widths.length > 0).length;
    console.log(`[hand-close] edges=${edges.length} closeEdges=${closes} frames=${probe.frames.length}`);
    expect(closes, 'at least the two full closes landed on a standing pack').toBeGreaterThanOrEqual(2);
    expect(bad, `the landing pose must BE the settled pose:\n  ${bad.join('\n  ')}`).toEqual([]);
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
        lastSeen: Record<string, number>, backVis: Record<string, boolean>, railEarly: number,
        orphans: Array<string>, landTimes: Array<number>, orphanSeen: Record<string, number>,
        lastBox?: {left: number, right: number, top: number, bottom: number},
      };
      const w = window as unknown as {__pp?: St};
      const st: St = {
        timer: 0, samples: 0, universe: 0, firstProxies: 0,
        ghosts: [], airborn: [], overlays: 0, worst: 0, lastSeen: {}, backVis: {}, railEarly: -1,
        orphans: [], landTimes: [], orphanSeen: {},
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
        // THE CHROME WAITS: at flight start the verdict rail must be
        // transparent (it materializes around the LANDED cards, never over
        // the flying ones — it out-stacks the flights by z-design).
        if (st.railEarly < 0 && proxies.length >= 6) {
          const rail = document.querySelector<HTMLElement>('.con-hand__verdictbar');
          if (rail !== null) {
            st.railEarly = Number(getComputedStyle(rail).opacity);
          }
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
        // «ИЗ ВОЗДУХА» + THE IDENTITY INVARIANT. While an episode FLIES —
        // the album slots are held (`.con-hand--transit`), so the proxies
        // are the only bodies — a HIDDEN dock back is legal ONLY when its
        // own proxy is the live body on screen. Scoped to the transit hold
        // on purpose: after the open's finalize the slots ARE the bodies
        // (packets legitimately park beyond the stage edge), and the
        // teardown fade's transparent proxy corpses may outlive the fade on
        // a starved compositor until the wall-clock backstop sweeps them —
        // a hidden back is then simply «the album owns this card».
        // Armed while slots are held (open/filter flights) OR the hand
        // section is gone entirely (the close gather flies over the board);
        // a landed close back is visible, so the close teardown stays quiet.
        const episodeLive = proxies.length > 0 &&
          (document.querySelector('.con-hand--transit') !== null ||
           document.querySelector('.con-hand') === null);
        const proxyAlpha: Record<string, number> = {};
        for (const proxy of proxies) {
          const n = proxy.getAttribute('data-reveal-card') ?? '';
          proxyAlpha[n] = Math.max(proxyAlpha[n] ?? 0, Number(getComputedStyle(proxy).opacity));
        }
        for (const b of Array.from(document.querySelectorAll<HTMLElement>('[data-hand-dock-card]'))) {
          const name = b.getAttribute('data-hand-dock-card') ?? '';
          const cs = getComputedStyle(b);
          const vis = b.getBoundingClientRect().width > 8 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.5;
          const was = st.backVis[name] === true;
          if (!vis && episodeLive && (proxyAlpha[name] ?? 0) < 0.05) {
            // TWO-SAMPLE CONFIRMATION: an MO-driven sampler legitimately
            // sees the pre-paint microtask between the flights write and
            // the gsap placement (never painted). A REAL vanished card
            // stays vanished — confirm only when the same name is orphaned
            // again ≥ 60ms later.
            const first = st.orphanSeen[name];
            if (first === undefined) {
              st.orphanSeen[name] = now;
            } else if (now - first > 60 && st.orphans.length < 8) {
              st.orphans.push(name + '@t=' + Math.round(now) + ' first=' + Math.round(first));
            }
          } else {
            delete st.orphanSeen[name];
          }
          if (vis && !was && episodeLive) {
            st.landTimes.push(Math.round(now));
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
      const w = window as unknown as {__pp: {timer: number, samples: number, universe: number, firstProxies: number, ghosts: Array<string>, airborn: Array<string>, overlays: number, worst: number, railEarly: number, orphans: Array<string>, landTimes: Array<number>}};
      window.clearInterval(w.__pp.timer);
      const {samples, universe, firstProxies, ghosts, airborn, overlays, worst, railEarly, orphans, landTimes} = w.__pp;
      const landSpread = landTimes.length < 2 ? 0 : landTimes[landTimes.length - 1] - landTimes[0];
      return {samples, universe, firstProxies, ghosts, airborn, overlays, worst: Math.round(worst * 100) / 100, railEarly, orphans, lands: landTimes.length, landSpread};
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
    // The chrome-wait contract: witnessed AND transparent at flight start.
    expect(pp.railEarly, 'the rail was sampled at flight start').toBeGreaterThanOrEqual(0);
    expect(pp.railEarly, 'the verdict rail stays transparent over the flying cards').toBeLessThan(0.1);
    // THE IDENTITY INVARIANT: a hidden back always has its live proxy —
    // a card can never vanish, whatever the hand size or pairing.
    expect(pp.orphans, 'no hidden back ever stood without its live proxy').toEqual([]);
    console.log('[packet-physics] gather materialized over ' + pp.landSpread + 'ms in ' + pp.lands + ' steps');
  });
});
