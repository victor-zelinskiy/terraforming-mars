import {test, expect, Page} from './consoleTest';
import {bootIntoGame, openQuickWheel, press, pressUntil, settle, soloGameConfig, waitForTurn} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness, pageNow, Witness} from './witness';
import type {ObservedSample} from './observeCore';

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
 *
 * Both probes are RECORDINGS (FLAKE ZERO — `armWitness`, armed before the
 * tour, replace-proof): every state the product writes is sampled when the
 * task that wrote it has run its microtasks (`settled` — the state a frame can
 * paint: «the landing pose», «a hidden back with no live proxy», «a proxy half
 * faded with no twin» are COEXISTENCE claims) and once per frame (the flights
 * are tweens: they move style, not structure). Only a CHANGED state is kept,
 * each with the PAGE's time, so a state's duration is the span to the next
 * one — the analysis below folds the record on this side.
 */

const GAME_CONFIG = soloGameConfig({
  players: [{name: 'CloseLanding', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.37,
});

/** One recorded state of the pack: how many bodies the flight layer owns, and the docked bodies' widths. */
type PoseSeen = {fly: number, widths: Array<number>};
type PoseFrame = PoseSeen & {t: number};

/** «The settled pose» is the one STANDING this long after a release (the old probe's 700 ms). */
const SETTLED_AFTER_MS = 700;

async function armPoseWatch(page: Page): Promise<Witness<PoseSeen>> {
  return armWitness<PoseSeen>(page, 'hand-close-pose', () => {
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
    return {fly, widths};
  }, {settled: true, max: 20_000});
}

/** The page time of the LAST release edge in the record (the flight layer emptied: fly > 0 → 0). */
function lastRelease(samples: ReadonlyArray<ObservedSample<PoseSeen>>): number | undefined {
  for (let i = samples.length - 1; i > 0; i--) {
    if (samples[i - 1].v.fly > 0 && samples[i].v.fly === 0) {
      return samples[i].t;
    }
  }
  return undefined;
}

/**
 * A TRIP IS OVER when the hand is gone and the console is quiet — and, for the pose analysis, once the page clock has
 * passed the trip's release by the settle window: the pose that STANDS then is what the release is compared with, so
 * it must be in the record before the next episode starts (the old fixed pause between trips stood in for this).
 */
async function tripOver(page: Page, poses?: Witness<PoseSeen>): Promise<void> {
  await expect(page.locator('.con-hand'), 'B must hand the screen back').toHaveCount(0, {timeout: 20_000});
  await settle(page);
  if (poses === undefined) {
    return;
  }
  // The trip's own release is in the record: the flight layer owns no body any more.
  await expect.poll(async () => (await poses.last())?.fly ?? 0, {message: 'the gather never released its bodies', timeout: 20_000})
    .toBe(0);
  const release = lastRelease(await poses.samples());
  if (release !== undefined) {
    await expect.poll(() => pageNow(page), {message: 'the page clock never passed the release\'s settle window'})
      .toBeGreaterThan(release + SETTLED_AFTER_MS);
  }
}

/** A FULL open: the wheel (verified), A on its centre until the wheel answers, the open episode over (transit gone). */
async function openHandFully(page: Page, settleMs: number): Promise<void> {
  const hand = page.locator('.con-hand');
  const wheel = page.locator('.con-quick');
  await openQuickWheel(page); // RT wheel
  // «КАРТЫ» — the open episode. On a quick wheel the press IS the activation: the wheel leaving is its effect.
  await pressUntil(page, 'Enter', async () => await hand.count() > 0 || await wheel.count() === 0, {settleMs});
  await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 20_000});
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
    await settle(page);
    const poses = await armPoseWatch(page);

    // Two full open→close round trips (the second re-uses warmed poses).
    for (let i = 0; i < 2; i++) {
      await openHandFully(page, 2400);
      await press(page, 'Escape', 2600); // B — the close gather
      await tripOver(page, poses);
    }

    // MID-OPEN CANCELS: B lands while the open episode is still flying —
    // the rewind must land on LIVE berths too (the reversed timeline flies
    // to its launch snapshot; the corrective final approach + the cancel
    // accent are what this pins). Three cancel points: early, mid, late.
    // (The press's own ceiling IS the cancel point here — the subject.)
    for (const cancelAt of [220, 420, 650]) {
      await openQuickWheel(page); // RT wheel
      await press(page, 'Enter', cancelAt); // the open starts…
      await press(page, 'Escape', 2400); // …and B cancels it mid-flight
      await tripOver(page, poses);
    }

    const end = await pageNow(page);
    const frames: Array<PoseFrame> = (await poses.stop()).map((s) => ({...s.v, t: s.t}));

    // The recorder's own liveness only (FLAKE ZERO, recipe item 8): a recording keeps a CHANGED state, never a tick.
    expect(frames.length, 'the watch sampled the whole tour').toBeGreaterThan(0);

    // RELEASE EDGES: the states where an episode let its bodies go (flying
    // dropped to zero). At each edge with a standing pack, the card widths
    // must MATCH the settled widths ≥700ms later — a mismatch is exactly the
    // «прилетели в миниатюру, затем стали обычными» scale snap. The settled
    // pose is the one STANDING 700 ms after the release (the last recorded
    // state at or before that moment) — only where the quiet lasted that long.
    const edges: Array<{at: number, release: PoseFrame, settled: PoseFrame}> = [];
    for (let i = 1; i < frames.length; i++) {
      if (frames[i - 1].fly > 0 && frames[i].fly === 0) {
        const release = frames[i];
        const at = release.t + SETTLED_AFTER_MS;
        // …still quiet: no new episode started between release and settle.
        const next = frames.findIndex((f, j) => j > i && f.fly > 0);
        const quietUntil = next < 0 ? end : frames[next].t;
        if (quietUntil > at) {
          let k = i;
          while (k + 1 < frames.length && frames[k + 1].t <= at) {
            k++;
          }
          edges.push({at: release.t, release, settled: frames[k]});
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
    console.log(`[hand-close] edges=${edges.length} closeEdges=${closes} frames=${frames.length}`);
    expect(closes, 'at least the two full closes landed on a standing pack').toBeGreaterThanOrEqual(2);
    expect(bad, `the landing pose must BE the settled pose:\n  ${bad.join('\n  ')}`).toEqual([]);
  });
});

/** One flying proxy as recorded: its name, opacity, box, whether a twin is visible, its offset from a visible back. */
type ProxySeen = {n: string, op: number, l: number, r: number, t: number, b: number, w: number, twin: boolean, d: number | null};
/** One recorded state of the packet tour. */
type PacketSeen = {
  /** The hand screen's box (only while it is laid out wider than 100 px). */
  hand: {l: number, r: number, t: number, b: number} | null,
  /** The verdict rail's opacity (null — no rail). */
  rail: number | null,
  /** The album's slots are held (an open / filter flight). */
  transit: boolean,
  /** The hand section is mounted. */
  handUp: boolean,
  proxies: Array<ProxySeen>,
  backs: Array<{n: string, vis: boolean}>,
};

/** How many dock backs STAND visible — the packet-dominated hand's universe. */
async function visibleDockBacks(page: Page): Promise<number> {
  return page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('[data-hand-dock-card]'))
    .filter((b) => {
      const r = b.getBoundingClientRect();
      const cs = getComputedStyle(b);
      return r.width > 8 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.5;
    }).length);
}

async function armPacketWatch(page: Page): Promise<Witness<PacketSeen>> {
  return armWitness<PacketSeen>(page, 'hand-packet-physics', () => {
    const r1 = (x: number) => Math.round(x * 10) / 10;
    const shown = (el: HTMLElement | null) => {
      if (el === null) {
        return false;
      }
      const cs = getComputedStyle(el);
      return el.getBoundingClientRect().width > 8 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.5;
    };
    const hand = document.querySelector<HTMLElement>('.con-hand');
    const hb = hand?.getBoundingClientRect();
    const rail = document.querySelector<HTMLElement>('.con-hand__verdictbar');
    const proxies = Array.from(document.querySelectorAll<HTMLElement>('.con-handreveal-layer .con-deal-proxy[data-reveal-card]'))
      .map((proxy) => {
        const n = proxy.getAttribute('data-reveal-card') ?? '';
        const pr = proxy.getBoundingClientRect();
        const twinBack = document.querySelector<HTMLElement>('[data-hand-dock-card="' + CSS.escape(n) + '"]');
        const twinSlot = document.querySelector<HTMLElement>('[data-zoom-slot="' + CSS.escape(n) + '"]');
        // The overlay witness (proxy vs its materialized back): the centre offset, while both stand.
        let d: number | null = null;
        if (twinBack !== null && pr.width > 8) {
          const bs = getComputedStyle(twinBack);
          const br = twinBack.getBoundingClientRect();
          if (bs.visibility !== 'hidden' && Number(bs.opacity) > 0.5 && br.width > 8) {
            const dx = (pr.left + pr.width / 2) - (br.left + br.width / 2);
            const dy = (pr.top + pr.height / 2) - (br.top + br.height / 2);
            d = Math.round(Math.max(Math.abs(dx), Math.abs(dy)) * 100) / 100;
          }
        }
        return {
          n, op: Math.round(Number(getComputedStyle(proxy).opacity) * 1000) / 1000,
          l: r1(pr.left), r: r1(pr.right), t: r1(pr.top), b: r1(pr.bottom), w: r1(pr.width),
          twin: shown(twinBack) || shown(twinSlot), d,
        };
      });
    return {
      hand: hb === undefined || hb.width <= 100 ? null : {l: r1(hb.left), r: r1(hb.right), t: r1(hb.top), b: r1(hb.bottom)},
      rail: rail === null ? null : Number(getComputedStyle(rail).opacity),
      transit: document.querySelector('.con-hand--transit') !== null,
      handUp: hand !== null,
      proxies,
      backs: Array.from(document.querySelectorAll<HTMLElement>('[data-hand-dock-card]'))
        .map((b) => ({n: b.getAttribute('data-hand-dock-card') ?? '', vis: shown(b)})),
    };
  }, {settled: true, max: 20_000});
}

/**
 * The packet tour's detectors, FOLDED over the record (page time, a state standing until the next one):
 * ACCOUNTING (the first flight state's body count), GHOSTS, «ИЗ ВОЗДУХА» (a back materializing with no proxy seen
 * within 450 ms), the overlay witness, the rail at flight start, and THE IDENTITY INVARIANT (a hidden back with no live
 * proxy, standing more than 60 ms).
 */
function foldPackets(samples: ReadonlyArray<ObservedSample<PacketSeen>>, end: number) {
  let firstProxies = 0;
  let railEarly = -1;
  let overlays = 0;
  let worst = 0;
  const ghosts: Array<string> = [];
  const airborn: Array<string> = [];
  const orphans: Array<string> = [];
  const landTimes: Array<number> = [];
  const lastSeen: Record<string, number> = {};
  const backVis: Record<string, boolean> = {};
  const orphanSince: Record<string, number> = {};
  let lastBox: PacketSeen['hand'] = null;
  let standing: Array<string> = [];
  // An orphan span ends at `t`: it is CONFIRMED when the hidden back stood with no live proxy for more than 60 ms (a
  // span shorter than that is a hand-off between two writes, the old two-sample confirmation's window).
  const closeOrphan = (n: string, t: number) => {
    const since = orphanSince[n];
    if (since !== undefined && t - since > 60 && orphans.length < 8) {
      orphans.push(n + '@t=' + Math.round(t) + ' first=' + Math.round(since));
    }
    delete orphanSince[n];
  };
  for (const {t, v} of samples) {
    // A proxy of the previous state stood on screen until this one.
    for (const n of standing) {
      lastSeen[n] = t;
    }
    if (v.hand !== null) {
      lastBox = v.hand;
    }
    if (v.proxies.length > 0 && firstProxies === 0) {
      firstProxies = v.proxies.length;
    }
    // THE CHROME WAITS: at flight start the verdict rail must be
    // transparent (it materializes around the LANDED cards, never over
    // the flying ones — it out-stacks the flights by z-design).
    if (railEarly < 0 && v.proxies.length >= 6 && v.rail !== null) {
      railEarly = v.rail;
    }
    for (const p of v.proxies) {
      lastSeen[p.n] = t;
      // GHOST: a half-transparent card with NO visible twin underneath —
      // a card genuinely dissolving into a hole. The no-dip teardown fade
      // (proxy fading ON TOP of its already-visible back/slot) is legit.
      const box = lastBox;
      if (p.op > 0.05 && p.op < 0.92 && box !== null && p.w > 8 &&
          p.r > box.l && p.l < box.r && p.b > box.t && p.t < box.b - 40 && !p.twin && ghosts.length < 8) {
        ghosts.push(p.n + '@op=' + p.op.toFixed(2));
      }
      if (p.d !== null) {
        overlays++;
        worst = Math.max(worst, p.d);
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
    const episodeLive = v.proxies.length > 0 && (v.transit || !v.handUp);
    const proxyAlpha: Record<string, number> = {};
    for (const p of v.proxies) {
      proxyAlpha[p.n] = Math.max(proxyAlpha[p.n] ?? 0, p.op);
    }
    const present = new Set(v.backs.map((b) => b.n));
    for (const n of Object.keys(orphanSince)) {
      if (!present.has(n)) {
        closeOrphan(n, t);
      }
    }
    for (const b of v.backs) {
      const was = backVis[b.n] === true;
      if (!b.vis && episodeLive && (proxyAlpha[b.n] ?? 0) < 0.05) {
        orphanSince[b.n] ??= t;
      } else if (orphanSince[b.n] !== undefined) {
        closeOrphan(b.n, t);
      }
      if (b.vis && !was && episodeLive) {
        landTimes.push(Math.round(t));
        const seen = lastSeen[b.n];
        if (seen === undefined || t - seen > 450) {
          if (airborn.length < 8) {
            airborn.push(b.n + '@gap=' + (seen === undefined ? 'never' : String(Math.round(t - seen))));
          }
        }
      }
      backVis[b.n] = b.vis;
    }
    standing = v.proxies.map((p) => p.n);
  }
  for (const n of Object.keys(orphanSince)) {
    closeOrphan(n, end);
  }
  const landSpread = landTimes.length < 2 ? 0 : landTimes[landTimes.length - 1] - landTimes[0];
  return {samples: samples.length, firstProxies, ghosts, airborn, overlays, worst: Math.round(worst * 100) / 100, railEarly,
    orphans, lands: landTimes.length, landSpread};
}

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
    // The universe is the pack STANDING in the dock — read at rest (C), and asserted live (a poll): the deal into the
    // dock ends on its own clock.
    let universe = 0;
    await expect.poll(async () => {
      universe = await readSettled(page, () => visibleDockBacks(page), {message: 'the dock\'s standing backs'});
      return universe;
    }, {message: 'a packet-dominated hand stood in the dock', timeout: 30_000}).toBeGreaterThanOrEqual(9);

    const watch = await armPacketWatch(page);

    // Open → close, twice (the second run re-uses warmed poses/packets).
    for (let i = 0; i < 2; i++) {
      await openHandFully(page, 2600);
      await press(page, 'Escape', 2800); // B — the close gather
      await tripOver(page);
    }

    const end = await pageNow(page);
    const pp = {universe, ...foldPackets(await watch.stop(), end)};
    console.log('[packet-physics]', JSON.stringify(pp));
    // The recorder's own liveness only (FLAKE ZERO, recipe item 8): a recording keeps a CHANGED state, never a tick.
    expect(pp.samples, 'the watch sampled the tours').toBeGreaterThan(0);
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
