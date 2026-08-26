import {test, expect, Page} from '@playwright/test';
import {bootIntoGame, press, soloGameConfig, waitForTurn} from './consoleStart';

/**
 * HAND ALBUM CONTINUITY — every card is ONE physical object with a
 * CONTINUOUS trajectory through the dock ⇄ album transition and the page
 * turns («Крупные карты», the packet-dominated 15-card hand of the report).
 *
 * The probe tracks, per card name, the card's VISIBLE BODY each sample —
 * whichever of its three representations currently paints (dock back /
 * flying proxy / album slot) — and records a violation when a body:
 *  · VANISHES while its last-seen rect is deep inside the stage (a card may
 *    only stop painting at a stage edge / viewport boundary, where the edge
 *    clip consumes it) — confirmed over two samples ≥40ms apart, so the
 *    pre-paint microtask between the flights write and the gsap placement
 *    can never false-positive;
 *  · POPS IN with its first-seen rect deep inside the stage (same two-sample
 *    confirmation; a materialization UNDER a still-standing proxy is never
 *    even an event — the union view keeps the body);
 * The MOTION half of the law (no hops faster than the bounded episode
 * clock) is asserted at the write site: the director's render-step witness
 * and foreign-clock audit warn `[hand-reveal] …` on any broken bound, and
 * the tests assert the warn list is EMPTY (a DOM sampler cannot tell a
 * bounded fast step at sparse ticks from a real hop; the product can,
 * exactly). Union counters are kept as diagnostics — a synchronized
 * cluster of individually-continuous edge crossings legitimately steps
 * the aggregate count.
 *
 * Proxy visibility honours the edge clip (`clip-path: inset(...)`) — a fully
 * clipped proxy is NOT a body, so a card «parked beyond the stage edge» is
 * legitimately invisible and its crossing is a gradual, per-frame narrowing.
 */

const NATURAL_W = 320; // CARD_NATURAL_W — the proxy's unscaled box width

type BodyEvent = {
  kind: 'vanish' | 'pop' | 'teleport' | 'hole' | 'pager' | 'swapjump' | 'dockjump',
  name: string,
  t: number,
  via: string,
  x: number, y: number, w: number, h: number,
  detail: string,
};

type ProbeOut = {
  samples: number,
  events: Array<BodyEvent>,
  maxDrop: number,
  maxJump: number,
  universe: number,
  worstDropAt: number,
  dropNote: string,
};

async function installProbe(page: Page): Promise<void> {
  await page.evaluate(({NATURAL_W}) => {
    /** `rt` — the wall-clock instant this body's rect was READ (a scan can
     *  stall mid-way on a forced layout, so «previous scan's start» lies by
     *  up to that stall for the elements read after it). */
    type Body = {via: string, x: number, y: number, w: number, h: number, tf?: string, rt: number};
    type St = {
      timer: number, samples: number, armed: boolean,
      events: Array<BodyEvent>,
      last: Map<string, {body: Body, t: number}>,
      gone: Map<string, {body: Body, t: number}>,
      pendingVanish: Map<string, {body: Body, t: number}>,
      pendingPop: Map<string, {body: Body, t: number}>,
      pendingZone: Map<string, {t: number, detail: string, x: number}>,
      stage?: {left: number, right: number},
      maxDrop: number, maxJump: number, worstDropAt: number, dropNote: string,
      lastRawUnion: number, prevConfirmed: number, prevConfirmedT: number,
      universe: number,
    };
    const w = window as unknown as {__hac?: St};
    if (w.__hac !== undefined) {
      clearInterval(w.__hac.timer);
    }
    const st: St = {
      timer: 0, samples: 0, armed: false, events: [],
      last: new Map(), gone: new Map(),
      pendingVanish: new Map(), pendingPop: new Map(), pendingZone: new Map(),
      maxDrop: 0, maxJump: 0, worstDropAt: 0, dropNote: '',
      lastRawUnion: -1, prevConfirmed: -1, prevConfirmedT: 0, universe: 0,
    };
    const t0 = performance.now();

    /** inset(top right bottom left) → [left, right] in the element's local px. */
    const insetLR = (cp: string): [number, number] | undefined => {
      if (cp === 'none' || !cp.startsWith('inset(')) {
        return undefined;
      }
      const nums = cp.slice(6).split(' ').map((v) => Number.parseFloat(v));
      if (nums.length < 4 || nums.some((n) => !Number.isFinite(n))) {
        return undefined;
      }
      return [nums[3], nums[1]];
    };
    /** The layer-wide STAGE WINDOW (viewport px) the proxies are clipped to. */
    const layerWindow = (): [number, number] => {
      const layer = document.querySelector<HTMLElement>('.con-handreveal-layer');
      if (layer === null) {
        return [0, window.innerWidth];
      }
      const lr = insetLR(getComputedStyle(layer).clipPath);
      if (lr === undefined) {
        return [0, window.innerWidth];
      }
      return [lr[0], window.innerWidth - lr[1]];
    };
    /** Fraction of the proxy's own box that survives BOTH its local clip and
     *  the layer's stage window. */
    const proxyVisible = (el: HTMLElement, r: DOMRect, win: [number, number]): {frac: number, x: number, w: number} => {
      let left = r.left;
      let right = r.right;
      const local = insetLR(getComputedStyle(el).clipPath);
      if (local !== undefined && r.width > 0) {
        const scale = r.width / NATURAL_W;
        left += local[0] * scale;
        right -= local[1] * scale;
      }
      left = Math.max(left, win[0]);
      right = Math.min(right, win[1]);
      const w = Math.max(0, right - left);
      return {frac: r.width > 0 ? w / r.width : 0, x: left, w};
    };
    const onScreen = (r: DOMRect): boolean =>
      r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight;
    const paintReady = (el: HTMLElement): boolean => {
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && Number(cs.opacity) >= 0.5;
    };

    const scan = () => {
      st.samples++;
      const now = performance.now() - t0;
      const album = document.querySelector<HTMLElement>('.con-hand__album');
      if (album !== null) {
        const ab = album.getBoundingClientRect();
        if (ab.width > 100) {
          st.stage = {left: ab.left, right: ab.right};
        }
      }
      const bodies = new Map<string, Body>();
      // Priority: slot < dock back < proxy (a proxy stands OVER the others).
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('.con-hand [data-zoom-slot]'))) {
        const name = el.getAttribute('data-zoom-slot') ?? '';
        // The transit hold hides the SLOT itself (opacity 0 !important) —
        // opacity does not inherit into computed values of descendants.
        if (!paintReady(el)) {
          continue;
        }
        const probeEl = el.querySelector<HTMLElement>('.pcard, .card-container') ?? el;
        if (!paintReady(probeEl)) {
          continue;
        }
        const r = probeEl.getBoundingClientRect();
        if (r.width > 8 && r.height > 8 && onScreen(r)) {
          bodies.set(name, {via: 'slot', x: r.left, y: r.top, w: r.width, h: r.height, rt: performance.now() - t0});
        }
      }
      // SINGLE-OWNER: the dock backs and the flight proxies are the SAME
      // elements under the SAME layer clip — visibility must be judged
      // identically for both representations (a parked packet body beyond
      // the stage window is INVISIBLE however its raw AABB overlaps the
      // viewport edge).
      const win = layerWindow();
      const backsAll: Array<{name: string, x: number, w: number, vis: boolean}> = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-hand-dock-card]'))) {
        const name = el.getAttribute('data-hand-dock-card') ?? '';
        const r = el.getBoundingClientRect();
        const clipped = proxyVisible(el, r, win);
        const vis = paintReady(el) && r.width > 8 && r.height > 8 && onScreen(r) &&
          clipped.frac > 0.08 && clipped.w > 8;
        if (r.width > 8) {
          backsAll.push({name, x: clipped.x, w: clipped.w, vis});
        }
        if (!vis || bodies.has(name)) {
          continue;
        }
        bodies.set(name, {via: 'dock', x: clipped.x, y: r.top, w: clipped.w, h: r.height, rt: performance.now() - t0});
      }
      const proxyRects: Array<{x: number, y: number, w: number, h: number}> = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('.con-handreveal-layer [data-reveal-card]'))) {
        const name = el.getAttribute('data-reveal-card') ?? '';
        // An unplaced proxy (the pre-paint microtask before gsap.set) sits
        // unstyled at the layer origin — never a body.
        if (el.style.transform === '' || !paintReady(el)) {
          continue;
        }
        const r = el.getBoundingClientRect();
        if (r.width <= 8 || r.height <= 8 || !onScreen(r)) {
          continue;
        }
        const vis = proxyVisible(el, r, win);
        if (vis.frac <= 0.08 || vis.w < 8) {
          continue;
        }
        proxyRects.push({x: vis.x, y: r.top, w: vis.w, h: r.height});
        bodies.set(name, {via: 'proxy', x: vis.x, y: r.top, w: vis.w, h: r.height, tf: el.style.transform.slice(0, 90), rt: performance.now() - t0});
      }
      st.universe = Math.max(st.universe, bodies.size);
      const union = bodies.size;
      if (st.armed) {
        const dt = now - st.prevConfirmedT;
        // MASS COUNTERS run between CONFIRMED unions only (the same value in
        // two consecutive samples): an MO-driven sample legitimately lands
        // inside the spawn flush — backs already hidden, proxies not yet
        // placed — a state that never paints. A REAL mass change persists.
        if (union === st.lastRawUnion) {
          if (st.prevConfirmed >= 0 && dt < 140) {
            const d = st.prevConfirmed - union;
            if (d > st.maxDrop) {
              st.maxDrop = d;
              st.worstDropAt = Math.round(now);
              st.dropNote = `${st.prevConfirmed} -> ${union}`;
            }
            st.maxJump = Math.max(st.maxJump, -d);
          }
          st.prevConfirmed = union;
          st.prevConfirmedT = now;
        }
        st.lastRawUnion = union;

        const nearEdge = (b: Body): boolean => {
          const tol = Math.max(60, b.w * 0.8);
          const vpw = window.innerWidth;
          const vph = window.innerHeight;
          if (b.x < tol || b.x + b.w > vpw - tol || b.y < tol || b.y + b.h > vph - 170) {
            return true; // viewport boundary / the footer band (dock swaps)
          }
          const s = st.stage;
          if (s !== undefined) {
            if (Math.abs(b.x - s.left) < tol || Math.abs(b.x + b.w - s.left) < tol ||
                Math.abs(b.x - s.right) < tol || Math.abs(b.x + b.w - s.right) < tol) {
              return true; // the album's own stage edge (the clip line)
            }
          }
          return false;
        };
        // VANISH — two-sample confirmation ≥40ms apart.
        for (const [name, rec] of st.last) {
          const cur = bodies.get(name);
          if (cur === undefined) {
            const pend = st.pendingVanish.get(name);
            if (pend === undefined) {
              st.pendingVanish.set(name, rec);
            } else if (now - pend.t > 40) {
              st.gone.set(name, pend);
              st.pendingVanish.delete(name);
              if (!nearEdge(pend.body) && st.events.length < 24) {
                st.events.push({
                  kind: 'vanish', name, t: Math.round(now), via: pend.body.via,
                  x: Math.round(pend.body.x), y: Math.round(pend.body.y),
                  w: Math.round(pend.body.w), h: Math.round(pend.body.h),
                  detail: `confirmed after ${Math.round(now - pend.t)}ms`,
                });
              }
            }
          } else {
            st.pendingVanish.delete(name);
            // THE SWAP IS BORN IN PLACE: when a card's body switches from
            // its REAL dock back to its flight proxy (the episode's first
            // frame), the proxy must stand EXACTLY where the back just
            // stood — «первый кадр анимации попиксельно совпадает с
            // последним статичным». A pose snap here (the intake accent
            // used to snap the raised/hover pose to the resting one in the
            // same flush) is the reported «веер одним кадром стал другим».
            if (rec.body.via === 'dock' && cur.via === 'proxy' && now - rec.t < 80) {
              const dcx = (cur.x + cur.w / 2) - (rec.body.x + rec.body.w / 2);
              const dcy = (cur.y + cur.h / 2) - (rec.body.y + rec.body.h / 2);
              const dw = cur.w - rec.body.w;
              if ((Math.abs(dcx) > 10 || Math.abs(dcy) > 10 || Math.abs(dw) > 10) && st.events.length < 24) {
                st.events.push({
                  kind: 'swapjump', name, t: Math.round(now), via: 'proxy',
                  x: Math.round(cur.x), y: Math.round(cur.y), w: Math.round(cur.w), h: Math.round(cur.h),
                  detail: `Δc=(${Math.round(dcx)},${Math.round(dcy)}) Δw=${Math.round(dw)} from dock@(${Math.round(rec.body.x)},${Math.round(rec.body.y)} ${Math.round(rec.body.w)}w)`,
                });
              }
            }
            // THE VISIBLE PACK NEVER RE-POSES IN A BLINK: a dock back that
            // relocates faster than its own 340 ms pose rides can (>14 px
            // of centre in <40 ms) is the accent's transition-killing snap
            // — the fan «одним кадром становится другим» while the player
            // is looking straight at it. The smooth hover/raise rides move
            // ~1–3 px per frame and stay far under this line.
            if (rec.body.via === 'dock' && cur.via === 'dock') {
              const bdt2 = cur.rt - rec.body.rt;
              const dcx = (cur.x + cur.w / 2) - (rec.body.x + rec.body.w / 2);
              const dcy = (cur.y + cur.h / 2) - (rec.body.y + rec.body.h / 2);
              const sc2 = (() => {
                const v = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--con-ui-scale'));
                return Number.isFinite(v) && v > 0 ? v : 1;
              })();
              if (bdt2 > 2 && bdt2 < 40 && Math.hypot(dcx, dcy) > 14 * sc2 && st.events.length < 24) {
                st.events.push({
                  kind: 'dockjump', name, t: Math.round(now), via: 'dock',
                  x: Math.round(cur.x), y: Math.round(cur.y), w: Math.round(cur.w), h: Math.round(cur.h),
                  detail: `Δc=(${Math.round(dcx)},${Math.round(dcy)}) in ${Math.round(bdt2)}ms`,
                });
              }
            }
            // (No DOM-side speed detector: a bounded 28 ms clock step of the
            // close's fastest leg legitimately moves a card 250–400+ px —
            // ×2 at 4K — and nothing sampling the DOM at arbitrary instants
            // can tell that from a real hop. MOTION bounds are asserted by
            // the PRODUCT's own render-step witness + foreign-clock audit,
            // surfaced as `[hand-reveal]` warns and asserted empty below;
            // this probe owns state EXISTENCE — vanish/pop «из воздуха».)
          }
        }
        // POP — two-sample confirmation; judged by where it appears.
        for (const [name, b] of bodies) {
          if (st.last.has(name)) {
            st.pendingPop.delete(name);
            continue;
          }
          const pend = st.pendingPop.get(name);
          if (pend === undefined) {
            st.pendingPop.set(name, {body: b, t: now});
          } else if (now - pend.t > 40) {
            st.pendingPop.delete(name);
            if (!nearEdge(pend.body) && st.events.length < 24) {
              const wasGone = st.gone.get(name);
              st.events.push({
                kind: 'pop', name, t: Math.round(now), via: pend.body.via,
                x: Math.round(pend.body.x), y: Math.round(pend.body.y),
                w: Math.round(pend.body.w), h: Math.round(pend.body.h),
                detail: wasGone === undefined ? 'first appearance' :
                  `gone since t=${Math.round(wasGone.t)} (was ${wasGone.body.via}@${Math.round(wasGone.body.x)},${Math.round(wasGone.body.y)})`,
              });
            }
          }
        }
        for (const name of [...st.pendingPop.keys()]) {
          if (!bodies.has(name)) {
            st.pendingPop.delete(name);
          }
        }
        // ── THE DOCK-ZONE COMPOSITION (the reported «handDock дырявый») ──
        // While reveal proxies fly, the visible backs of the pack must form
        // ONE solid run: a hidden back whose berth sits strictly INSIDE the
        // visible span, with a real visible notch there and NO card body
        // near it, is a HOLE in the fan. And the album spine's opaque well
        // may not stand over the bay while cards launch/land through it.
        const zoneSeen = new Set<string>();
        if (proxyRects.length > 0) {
          const visBacks = backsAll.filter((b) => b.vis).sort((a, b) => a.x - b.x);
          if (visBacks.length >= 2) {
            const centers = visBacks.map((b) => b.x + b.w / 2);
            const spanL = centers[0];
            const spanR = centers[centers.length - 1];
            for (const b of backsAll) {
              if (b.vis) {
                continue;
              }
              const c = b.x + b.w / 2;
              if (c <= spanL + 1 || c >= spanR - 1) {
                continue; // missing only from the pack's receding edge — legal
              }
              let leftC = spanL;
              let rightC = spanR;
              for (const vc of centers) {
                if (vc < c) {
                  leftC = vc;
                } else {
                  rightC = vc;
                  break;
                }
              }
              const notch = rightC - leftC;
              const bodyNear = proxyRects.some((p) =>
                Math.abs((p.x + p.w / 2) - c) < b.w * 1.4 && p.y + p.h > window.innerHeight - 240);
              if (notch > b.w * 0.8 && !bodyNear) {
                const key = `hole:${b.name}`;
                zoneSeen.add(key);
                const pend = st.pendingZone.get(key);
                if (pend === undefined) {
                  st.pendingZone.set(key, {t: now, x: c, detail: `notch ${Math.round(notch)}px inside [${Math.round(spanL)}..${Math.round(spanR)}]`});
                } else if (now - pend.t > 60 && st.events.length < 24) {
                  st.pendingZone.delete(key);
                  st.events.push({
                    kind: 'hole', name: b.name, t: Math.round(now), via: 'dock',
                    x: Math.round(pend.x), y: 0, w: Math.round(b.w), h: 0,
                    detail: pend.detail,
                  });
                }
              }
            }
          }
          const pager = document.querySelector<HTMLElement>('.con-handdock__pager');
          if (pager !== null && Number(getComputedStyle(pager).opacity) > 0.15) {
            const key = 'pager';
            zoneSeen.add(key);
            const pend = st.pendingZone.get(key);
            if (pend === undefined) {
              st.pendingZone.set(key, {t: now, x: 0, detail: ''});
            } else if (now - pend.t > 60 && st.events.length < 24) {
              st.pendingZone.delete(key);
              st.events.push({
                kind: 'pager', name: 'album-spine', t: Math.round(now), via: 'dock',
                x: 0, y: 0, w: 0, h: 0,
                detail: `opaque instrument well over the bay mid-flight (opacity ${getComputedStyle(pager).opacity})`,
              });
            }
          }
        }
        for (const key of [...st.pendingZone.keys()]) {
          if (!zoneSeen.has(key)) {
            st.pendingZone.delete(key);
          }
        }
      }
      st.last = new Map([...bodies].map(([n, b]) => [n, {body: b, t: now}]));
    };
    st.timer = window.setInterval(scan, 16) as unknown as number;
    new MutationObserver(scan).observe(document.body, {childList: true, subtree: true, attributes: true});
    w.__hac = st;
    scan();
  }, {NATURAL_W});
}

async function armProbe(page: Page, armed: boolean): Promise<void> {
  await page.evaluate((on) => {
    const st = (window as unknown as {__hac?: {armed: boolean, lastRawUnion: number, prevConfirmed: number}}).__hac;
    if (st !== undefined) {
      st.armed = on;
      st.lastRawUnion = -1;
      st.prevConfirmed = -1;
    }
  }, armed);
}

async function readProbe(page: Page): Promise<ProbeOut> {
  return page.evaluate(() => {
    const w = window as unknown as {__hac: ProbeOut & {timer: number}};
    window.clearInterval(w.__hac.timer);
    const {samples, events, maxDrop, maxJump, universe, worstDropAt, dropNote} = w.__hac;
    return {samples, events, maxDrop, maxJump, universe, worstDropAt, dropNote};
  });
}

/*
 * (A `page.screenshot` frame-pump between presses was tried here — the
 * forceframe lore — and REMOVED: serial 1080p screenshots are far more
 * expensive than the BeginFrames they force, and the self-inflicted load
 * stretched the tour ~2.4× and pushed the episode into its degrade paths.
 * The episode's own clock (rAF + interval co-driver in handRevealDirector)
 * advances the flight without any compositor help, and the probe reads
 * geometry, not pixels — no pump is needed.)
 */

async function bootLargeAlbum(page: Page, request: Parameters<typeof bootIntoGame>[1], buy: number, name: string, seed: number): Promise<Array<string>> {
  // Every degrade path AND every broken motion bound in the director names
  // itself with a `[hand-reveal]` warn (render-step witness, foreign-clock
  // audit, magnet wall/far-start, safety snap, conclude backstop). The
  // MOTION half of the continuity law is asserted through these — the DOM
  // probe cannot tell a bounded fast step at sparse ticks from a real hop,
  // but the product can, exactly, at the write site.
  const warns: Array<string> = [];
  page.on('console', (m) => {
    if (!m.text().includes('[hand-reveal]')) {
      return;
    }
    console.log(`PAGE: ${m.text()}`);
    // The per-episode `arm … rev=N` line is console.INFO (a build-identity
    // witness, not a degrade) — only WARNINGS are asserted empty.
    if (m.type() === 'warning') {
      warns.push(m.text());
    }
  });
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('tm_console_album', 'large');
    } catch {
      /* adaptive layout still exercises packets */
    }
  });
  await bootIntoGame(page, request, {
    buy,
    config: soloGameConfig({
      players: [{name, color: 'red', beginner: false, handicap: 0, first: true}],
      seed,
    }),
  });
  await waitForTurn(page);
  await page.waitForTimeout(2500);
  // BUILD IDENTITY: the layer stamps the transition core's revision. A
  // mismatch means the server handed out a cached/stale chunk — the one
  // failure mode that reads exactly like «the fix changed nothing».
  const rev = await page.evaluate(() =>
    document.querySelector('.con-handreveal-layer')?.getAttribute('data-hand-reveal-rev') ?? '(no layer)');
  expect(rev, 'the served bundle carries the current transition core (stale-server trap)').toBe('14');
  await installProbe(page);
  await armProbe(page, true);
  return warns;
}

function assertContinuity(out: ProbeOut, minUniverse: number, label: string, warns: ReadonlyArray<string>): void {
  const story = out.events.slice(0, 12)
    .map((e) => `${e.kind} ${e.name} [${e.via}] t=${e.t} @(${e.x},${e.y} ${e.w}×${e.h}) ${e.detail}`)
    .join('\n  ');
  console.log(`[hac:${label}] samples=${out.samples} universe=${out.universe} maxDrop=${out.maxDrop}@t=${out.worstDropAt}${out.dropNote === '' ? '' : ` (${out.dropNote})`} maxJump=${out.maxJump} events=${out.events.length}`);
  expect(out.samples, `[${label}] the probe sampled the tour`).toBeGreaterThan(150);
  expect(out.universe, `[${label}] the hand stood`).toBeGreaterThanOrEqual(minUniverse);
  // THE LAW IS PER-CARD: no vanish or pop deep inside the stage, no teleport.
  // (The union counters above are diagnostics only: a synchronized CLUSTER of
  // individually-continuous edge crossings — 11 packets sliding out through
  // the boundary within one beat — legitimately moves the aggregate count in
  // a step, while every card stays on its own continuous trajectory. The
  // reported defect always trips the per-card detectors: a vanish/pop lands
  // deep inside the stage, and the dock-side «из воздуха» is additionally
  // pinned by the packet-physics spec's orphan/airborn detectors.)
  expect(out.events, `[${label}] discontinuity events:\n  ${story}`).toEqual([]);
  // …AND THE MOTION LAW, asserted at the write site: the director warns on
  // every broken bound / degrade (render-step witness, foreign clock,
  // magnet wall snap / far start, safety snap, conclude backstop).
  expect(warns, `[${label}] the director reported a degrade`).toEqual([]);
}

test.describe('hand album continuity · large layout', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

  test('15 cards: open, page turns and close keep every card continuous', async ({page, request}) => {
    test.setTimeout(420_000);
    const warns = await bootLargeAlbum(page, request, 15, 'Continuity', 0.29);

    // OPEN → page turns (LB/RB, incl. a fast burst) → CLOSE → reopen → close.
    await press(page, 'Period', 700); // RT wheel
    console.log('[hac] opening');
    await press(page, 'Enter', 2600); // «КАРТЫ» — the open episode
    console.log('[hac] paging');
    await press(page, 'KeyE', 900); // RB → page 2
    await press(page, 'KeyE', 900); // RB → page 3
    await press(page, 'KeyQ', 900); // LB → page 2
    await press(page, 'KeyE', 120); // fast burst
    await press(page, 'KeyQ', 120);
    await press(page, 'KeyE', 900);
    console.log('[hac] closing');
    await press(page, 'Escape', 2800); // B — the close gather
    console.log('[hac] reopening');
    await press(page, 'Period', 700);
    await press(page, 'Enter', 2600);
    console.log('[hac] closing 2');
    await press(page, 'Escape', 2800);
    await page.waitForTimeout(700);
    await armProbe(page, false);
    assertContinuity(await readProbe(page), 12, '15', warns);
  });

  test('3 cards (single page, mouse open) stay continuous', async ({page, request}) => {
    test.setTimeout(420_000);
    const warns = await bootLargeAlbum(page, request, 3, 'ContinuityS', 0.31);
    const preClick = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('.con-handreveal-layer [data-hand-dock-card]');
      const cs = el === null ? undefined : getComputedStyle(el);
      const r = el?.getBoundingClientRect();
      return {
        cls: document.querySelector('.con-handdock')?.className ?? '(none)',
        bodies: document.querySelectorAll('.con-handreveal-layer [data-hand-dock-card]').length,
        seated: Array.from(document.querySelectorAll<HTMLElement>('.con-handreveal-layer [data-hand-dock-card]'))
          .filter((e) => e.style.transform !== '').length,
        first: el === null ? '(none)' : {
          op: cs?.opacity, vis: cs?.visibility, clip: cs?.clipPath,
          rect: r === undefined ? [] : [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
          inner: [window.innerWidth, window.innerHeight],
          tf: el.style.transform.slice(0, 60),
        },
      };
    });
    console.log(`[hac] pre-click ${JSON.stringify(preClick)}`);
    console.log('[hac] opening via dock click');
    // Actionability needs two PAINTED frames; a fully idle headless
    // compositor can withhold them forever ([[e2e-raf-dies-headless]]).
    // The hit-target itself is asserted by the normal attempt first.
    await page.locator('.con-handdock').click({timeout: 8000})
      .catch(() => page.locator('.con-handdock').click({force: true}));
    console.log(`[hac] post-click hand=${await page.locator('.con-hand').count()}`);
    await page.waitForTimeout(2400);
    console.log('[hac] closing');
    await press(page, 'Escape', 2600);
    await page.waitForTimeout(600);
    await armProbe(page, false);
    assertContinuity(await readProbe(page), 3, '3', warns);
  });

  test('9 cards: close from the LAST page (1 card on it)', async ({page, request}) => {
    test.setTimeout(420_000);
    const warns = await bootLargeAlbum(page, request, 9, 'ContinuityL', 0.33);
    await press(page, 'Period', 700);
    await press(page, 'Enter', 2600);
    await press(page, 'KeyE', 900); // → page 2
    await press(page, 'KeyE', 900); // → page 3 (one card)
    console.log('[hac] closing from last page');
    await press(page, 'Escape', 2800);
    await page.waitForTimeout(600);
    await armProbe(page, false);
    assertContinuity(await readProbe(page), 8, '9', warns);
  });

  test('15 cards under 6× CPU throttle: the flight slows, never thins', async ({page, request}) => {
    test.setTimeout(420_000);
    const warns = await bootLargeAlbum(page, request, 15, 'ContinuityCPU', 0.43);
    // The reported machine: paints arrive slowly while the transition works.
    // The PAINT-LOCKED clock must answer with a slower, continuous flight —
    // never with a fan that thins between two painted frames.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', {rate: 6});
    console.log('[hac] throttled opening');
    await press(page, 'Period', 900);
    await press(page, 'Enter', 5200);
    console.log('[hac] throttled closing');
    await press(page, 'Escape', 5600);
    await cdp.send('Emulation.setCPUThrottlingRate', {rate: 1});
    await page.waitForTimeout(700);
    await armProbe(page, false);
    assertContinuity(await readProbe(page), 12, 'cpu6', warns);
  });

  test('20 cards: close from page 1, reopen, close again', async ({page, request}) => {
    test.setTimeout(420_000);
    const warns = await bootLargeAlbum(page, request, 20, 'ContinuityXL', 0.35);
    await press(page, 'Period', 700);
    await press(page, 'Enter', 2800);
    console.log('[hac] closing from page 1');
    await press(page, 'Escape', 3000);
    console.log('[hac] reopening');
    await press(page, 'Period', 700);
    await press(page, 'Enter', 2800);
    await press(page, 'Escape', 3000);
    await page.waitForTimeout(700);
    await armProbe(page, false);
    assertContinuity(await readProbe(page), 16, '20', warns);
  });
});

test.describe('hand album continuity · tv 4K profile', () => {
  test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1});
  test.describe.configure({mode: 'serial'});

  test('15 cards: open and close stay continuous at 4K', async ({page, request}) => {
    test.setTimeout(420_000);
    const warns = await bootLargeAlbum(page, request, 15, 'Continuity4K', 0.37);
    await press(page, 'Period', 900);
    await press(page, 'Enter', 3200);
    await press(page, 'Escape', 3400);
    await page.waitForTimeout(800);
    await armProbe(page, false);
    assertContinuity(await readProbe(page), 12, 'tv4k', warns);
  });
});

test.describe('hand album continuity · handheld profile', () => {
  test.use({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1});

  test('15 cards: open and close stay continuous on the Deck', async ({page, request}) => {
    test.setTimeout(420_000);
    const warns = await bootLargeAlbum(page, request, 15, 'ContinuityHH', 0.39);
    await press(page, 'Period', 700);
    await press(page, 'Enter', 2800);
    await press(page, 'Escape', 3000);
    await page.waitForTimeout(700);
    await armProbe(page, false);
    assertContinuity(await readProbe(page), 12, 'handheld', warns);
  });
});

test.describe('hand album continuity · reference rig (2560×1440 @1.5, forced tv)', () => {
  // The reporting rig's EXACT runtime geometry: Electron on a 4K TV at 150%
  // — 2560×1440 CSS viewport, devicePixelRatio 1.5 (physical 3840×2160),
  // tv profile FORCED, --con-ui-scale 1.3333. No earlier e2e project ran
  // this geometry, which is how three «green» fixes shipped defects only
  // this rig could show. Permanent acceptance condition for any change to
  // the hand transition core.
  test.use({viewport: {width: 2560, height: 1440}, deviceScaleFactor: 1.5});

  test('15 cards: open, page turn and close stay continuous on the rig', async ({page, request}) => {
    test.setTimeout(420_000);
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('tm_console_profile', 'tv');
      } catch {
        /* the physical-panel heuristic resolves tv here anyway */
      }
    });
    const warns = await bootLargeAlbum(page, request, 15, 'ContinuityRig', 0.41);
    await press(page, 'Period', 900);
    await press(page, 'Enter', 3200);
    await press(page, 'KeyE', 1600);
    await press(page, 'KeyQ', 1600);
    await press(page, 'Escape', 3400);
    await page.waitForTimeout(800);
    await armProbe(page, false);
    assertContinuity(await readProbe(page), 12, 'rig', warns);
  });
});
