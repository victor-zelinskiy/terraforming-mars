import {Page} from '@playwright/test';
import {CURSOR_EASE, CURSOR_MS} from '../../src/client/components/motion/motionTokens';
import {cubicBezierFromCss} from '../../src/client/components/motion/cubicBezier';

/**
 * THE CURSOR IS ONE LIVING OBJECT — its witness (TR58, `.claude/rules/console-ui.md` § THE CURSOR).
 *
 * The owner's report of 2026-10-16: «the focus appears in one frame and the card makes a micro-jump». No e2e asked HOW
 * the ring arrives: the probes read classes, and a class is on or off — a ring that snaps and a ring that grows read
 * the same to them. This witness reads the PAINTED pose, sample by sample, on a clock that keeps running on a quiet
 * screen (`MutationObserver` + `setInterval` 4 ms — never rAF: headless drives rAF off the compositor and a rAF sampler
 * stops exactly when the screen goes still):
 *  · every candidate's RING strength — the cursor layer's own opacity (`.con-cursor()` paints it on `::after` /
 *    `::before`), else the alpha of a spread ring in the element's or its face's `box-shadow` (the pre-TR58 paint);
 *  · its FACE box (the card / tile face, never a wrapper — a copy is compared face to face), its transform's scale;
 *  · its visibility down the ancestor chain;
 *  · a flying COPY of the cursored object, when the surface flies one (the hand's body);
 *  · a scroller's position; the long tasks.
 * and reports the defects of the class by name:
 *  · `snaps`      — a visible ring went from ≤ 20 % to ≥ 80 % of its full strength between two consecutive samples
 *                   FASTER than the cursor's own curve can carry it in that gap (`ringCurveGain` — an opacity
 *                   transition runs on the compositor, so a main thread starved for 96 ms sees 0.13 → 0.93 of a
 *                   perfectly smooth 180 ms arrival; the bound is the curve, never «two samples»);
 *  · `bornHidden` — the element became visible ALREADY carrying ≥ 80 % of its ring (the pose was born under a copy
 *                   or a fade and revealed with it — the hand's open);
 *  · `jumps`      — a visible face moved > 1.5 px between two samples with no animation running on it or an ancestor;
 *  · `handoff`    — copy face ↔ real face at the first sample both stand (Δ of the boxes) and how many samples a
 *                   visible copy and a visible face COEXISTED (a cross-fade of two pictures);
 *  · `scrollJumps`— the scroller moved > 24 logical px within one ≤ 20 ms sample gap (an instant scroll);
 *  · `zFlips`     — an element still enlarged (scale > 1.005) lost its raised `z-index` (it dives under a neighbour).
 * Every finding carries its sample time and the element's key, so a red names the moment, never «something snapped».
 */

export type FocusWitnessOptions = {
  /** Every element that can carry the cursor (the slots / tiles / rows) — the witness reads them all. */
  candidates: string;
  /** The face inside a candidate whose BOX is the object (`.pcard`); absent = the candidate itself. */
  face?: string;
  /** The attribute naming a candidate (`data-zoom-slot`); absent = its index among the candidates. */
  keyAttr?: string;
  /** The flying copy of a candidate, `${key}` replaced by its key (`[data-hand-dock-card="${key}"]`). */
  proxy?: string;
  /** The face inside the copy. */
  proxyFace?: string;
  /** A scroll viewport whose position the cursor drives. */
  scroller?: string;
};

export type FocusSample = {
  t: number;
  key: string;
  ring: number;
  vis: number;
  scale: number;
  z: number;
  box: [number, number, number, number];
  animating: boolean;
  proxy?: {box: [number, number, number, number], vis: number};
};

export type FocusFinding = {t: number, key: string, what: string};

export type FocusWitnessReport = {
  samples: number;
  /** The candidate keys that carried a ring at some point. */
  ringed: Array<string>;
  /** Per key: the strongest ring seen (the «full» strength). */
  full: Record<string, number>;
  snaps: Array<FocusFinding>;
  bornHidden: Array<FocusFinding>;
  jumps: Array<FocusFinding>;
  scrollJumps: Array<FocusFinding>;
  zFlips: Array<FocusFinding>;
  /** First sample where a copy and the real face of one key both stood visible: the box delta (px) and for how long (ms) the two pictures coexisted. */
  handoff: Array<{t: number, key: string, delta: number, coexistMs: number}>;
  /** Per key: the ms from the first sample with any ring to the first with ≥ 80 % (how long the arrival took). */
  arrivalMs: Record<string, number>;
  longTasks: Array<[number, number]>;
  /** The raw trail, compact (for a red's message and the stand's logs). */
  trail: Array<FocusSample>;
};

type WitnessWindow = {
  __focusWitness?: {t0: number, samples: Array<FocusSample>, scroll: Array<[number, number]>, long: Array<[number, number]>, stop: () => void, uiScale: number};
};

/** Arm the witness BEFORE the press. Re-arming replaces a previous one. */
export async function armFocusWitness(page: Page, opts: FocusWitnessOptions): Promise<void> {
  await page.evaluate((o) => {
    const w = window as unknown as WitnessWindow;
    w.__focusWitness?.stop();
    const t0 = performance.now();
    const samples: Array<FocusSample> = [];
    const scroll: Array<[number, number]> = [];
    const long: Array<[number, number]> = [];
    const uiScale = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--con-ui-scale')) || 1;
    const round = (n: number) => Math.round(n * 10) / 10;
    const boxOf = (el: Element): [number, number, number, number] => {
      const r = el.getBoundingClientRect();
      return [round(r.left), round(r.top), round(r.width), round(r.height)];
    };
    const visOf = (el: Element): number => {
      let v = 1;
      for (let n: Element | null = el; n !== null; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          return 0;
        }
        v *= Number(cs.opacity);
      }
      return Math.round(v * 100) / 100;
    };
    /**
     * The alpha of the first focus RING of a box-shadow list — a spread ring (`… 0px 0px 0px Npx`, inset or outer)
     * strong enough to be a cursor (alpha ≥ 0.4) and thick enough (spread ≥ 0.9 logical px): a state HAIRLINE (the
     * hand's mint «playable» thread, 26 %; a tile's resting border) is not a cursor. 0 when none.
     */
    const shadowRing = (bs: string): number => {
      if (bs === 'none' || bs === '') {
        return 0;
      }
      for (const part of bs.split(/,(?![^(]*\))/)) {
        const m = /rgba?\(([^)]*)\)\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px/.exec(part.trim());
        if (m === null) {
          continue;
        }
        const ch = m[1].split(',').map((s) => Number.parseFloat(s));
        const alpha = ch.length >= 4 ? ch[3] : 1;
        if (Number(m[2]) === 0 && Number(m[3]) === 0 && Number(m[5]) >= 0.9 * uiScale && alpha >= 0.4) {
          return alpha;
        }
      }
      return 0;
    };
    const ringOf = (el: Element, face: Element): number => {
      for (const pseudo of ['::after', '::before']) {
        const ps = getComputedStyle(el, pseudo);
        if (ps.content !== 'none' && ps.content !== 'normal' && shadowRing(ps.boxShadow) > 0) {
          return Math.round(Number(ps.opacity) * 100) / 100;
        }
      }
      const own = Math.max(shadowRing(getComputedStyle(el).boxShadow), face === el ? 0 : shadowRing(getComputedStyle(face).boxShadow));
      return Math.round(own * 100) / 100;
    };
    const scaleOf = (el: Element): number => {
      const tf = getComputedStyle(el).transform;
      const m = /matrix\(([^,]+),\s*([^,]+)/.exec(tf);
      if (m === null) {
        return 1;
      }
      return Math.round(Math.hypot(Number(m[1]), Number(m[2])) * 1000) / 1000;
    };
    const animatingOf = (el: Element): boolean => {
      for (let n: Element | null = el, k = 0; n !== null && k < 12; n = n.parentElement, k++) {
        if (n.getAnimations().some((a) => a.playState === 'running')) {
          return true;
        }
      }
      return false;
    };
    let last = '';
    const sample = () => {
      const t = Math.round(performance.now() - t0);
      const els = Array.from(document.querySelectorAll(o.candidates));
      const rows: Array<FocusSample> = [];
      els.forEach((el, i) => {
        const key = o.keyAttr !== undefined ? (el.getAttribute(o.keyAttr) ?? String(i)) : String(i);
        const face = o.face !== undefined ? (el.querySelector(o.face) ?? el) : el;
        const ring = ringOf(el, face);
        const scale = scaleOf(el);
        let proxy: FocusSample['proxy'];
        if (o.proxy !== undefined) {
          const p = document.querySelector(o.proxy.replace('${key}', CSS.escape(key)));
          if (p !== null) {
            const pf = o.proxyFace !== undefined ? (p.querySelector(o.proxyFace) ?? p) : p;
            proxy = {box: boxOf(pf), vis: visOf(p)};
          }
        }
        // Only the candidates that matter: a ring, a lift, or a live copy (the rest of a 30-tile grid is noise — and
        // reading every tile's ancestors on every 4 ms sample would itself starve the frame being measured).
        if (ring > 0 || scale > 1.001 || (proxy !== undefined && proxy.vis > 0)) {
          rows.push({
            t, key, ring, scale, proxy,
            vis: visOf(el),
            z: Number.parseInt(getComputedStyle(el).zIndex, 10) || 0,
            box: boxOf(face),
            animating: animatingOf(face),
          });
        }
      });
      const sig = JSON.stringify(rows.map((r) => [r.key, r.ring, r.vis, r.scale, r.z, r.box, r.proxy]));
      if (sig !== last) {
        last = sig;
        samples.push(...rows.length > 0 ? rows : [{t, key: '', ring: 0, vis: 0, scale: 1, z: 0, box: [0, 0, 0, 0] as [number, number, number, number], animating: false}]);
      }
      if (o.scroller !== undefined) {
        const sc = document.querySelector(o.scroller);
        if (sc !== null) {
          const top = Math.round(sc.scrollTop + sc.scrollLeft);
          if (scroll.length === 0 || scroll[scroll.length - 1][1] !== top) {
            scroll.push([t, top]);
          }
        }
      }
    };
    let lto: PerformanceObserver | undefined;
    try {
      lto = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          long.push([Math.round(e.startTime - t0), Math.round(e.duration)]);
        }
      });
      lto.observe({type: 'longtask', buffered: false});
    } catch {
      lto = undefined;
    }
    const iv = window.setInterval(sample, 4);
    const mo = new MutationObserver(sample);
    mo.observe(document.body, {subtree: true, attributes: true, childList: true});
    sample();
    w.__focusWitness = {t0, samples, scroll, long, uiScale, stop: () => {
      window.clearInterval(iv);
      mo.disconnect();
      lto?.disconnect();
    }};
  }, opts);
}

/** Stop the witness and read its report. */
export async function focusWitness(page: Page): Promise<FocusWitnessReport> {
  const raw = await page.evaluate(() => {
    const w = window as unknown as WitnessWindow;
    const fw = w.__focusWitness;
    fw?.stop();
    return fw === undefined ? undefined : {samples: fw.samples, scroll: fw.scroll, long: fw.long, uiScale: fw.uiScale};
  });
  if (raw === undefined) {
    throw new Error('focusWitness: the witness was never armed');
  }
  return analyseFocusTrail(raw.samples, raw.scroll, raw.long, raw.uiScale);
}

/** The analysis, pure (so a stand can re-read a saved trail). */
const cursorCurve = cubicBezierFromCss(CURSOR_EASE) ?? ((p: number) => p);
/**
 * The most the cursor's curve can move the ring in `dt` ms. The ease is front-loaded (concave), so the largest gain of
 * any window of that length is the window that starts at 0.
 */
export function ringCurveGain(dt: number): number {
  return cursorCurve(Math.min(1, Math.max(0, dt) / CURSOR_MS));
}

export function analyseFocusTrail(samples: ReadonlyArray<FocusSample>, scroll: ReadonlyArray<[number, number]>, long: ReadonlyArray<[number, number]>, uiScale: number): FocusWitnessReport {
  const byKey = new Map<string, Array<FocusSample>>();
  for (const s of samples) {
    if (s.key === '') {
      continue;
    }
    byKey.set(s.key, [...(byKey.get(s.key) ?? []), s]);
  }
  const full: Record<string, number> = {};
  for (const [key, rows] of byKey) {
    full[key] = Math.max(0, ...rows.map((r) => r.ring));
  }
  const snaps: Array<FocusFinding> = [];
  const bornHidden: Array<FocusFinding> = [];
  const jumps: Array<FocusFinding> = [];
  const zFlips: Array<FocusFinding> = [];
  const handoff: FocusWitnessReport['handoff'] = [];
  const arrivalMs: Record<string, number> = {};
  for (const [key, rows] of byKey) {
    const f = full[key];
    let coexistFrom: number | undefined;
    let coexistTo = 0;
    let handoffSeen = false;
    let firstRing: number | undefined;
    for (let i = 0; i < rows.length; i++) {
      const cur = rows[i];
      if (f > 0 && firstRing === undefined && cur.ring > 0.02 && cur.vis >= 0.5) {
        firstRing = cur.t;
      }
      if (f > 0 && firstRing !== undefined && arrivalMs[key] === undefined && cur.ring >= 0.8 * f) {
        arrivalMs[key] = cur.t - firstRing;
      }
      if (cur.proxy !== undefined && cur.proxy.vis > 0.05 && cur.vis > 0.05) {
        coexistFrom = coexistFrom ?? cur.t;
        coexistTo = cur.t;
        if (!handoffSeen) {
          handoffSeen = true;
          const d = Math.max(...cur.box.map((v, k) => Math.abs(v - cur.proxy!.box[k])));
          handoff.push({t: cur.t, key, delta: Math.round(d * 10) / 10, coexistMs: 0});
        }
      }
      if (i === 0) {
        continue;
      }
      const prev = rows[i - 1];
      if (f > 0 && cur.vis >= 0.5 && prev.vis >= 0.5) {
        const a = prev.ring / f;
        const b = cur.ring / f;
        const crossed = (a <= 0.2 && b >= 0.8) || (a >= 0.8 && b <= 0.2);
        if (crossed && Math.abs(b - a) > ringCurveGain(cur.t - prev.t) + 0.1) {
          snaps.push({t: cur.t, key, what: `ring ${prev.ring} → ${cur.ring} in ${cur.t - prev.t} ms (the curve allows ${ringCurveGain(cur.t - prev.t).toFixed(2)})`});
        }
      }
      if (f > 0 && prev.vis < 0.5 && cur.vis >= 0.5 && cur.ring >= 0.8 * f) {
        bornHidden.push({t: cur.t, key, what: `became visible (${prev.vis} → ${cur.vis}) already in its ring ${cur.ring}`});
      }
      const moved = Math.max(...cur.box.map((v, k) => Math.abs(v - prev.box[k])));
      if (moved > 1.5 * uiScale && cur.vis >= 0.5 && prev.vis >= 0.5 && !cur.animating && !prev.animating) {
        jumps.push({t: cur.t, key, what: `face moved ${moved.toFixed(1)} px with no animation (${JSON.stringify(prev.box)} → ${JSON.stringify(cur.box)})`});
      }
      if (prev.z > cur.z && cur.scale > 1.005 && cur.vis >= 0.5) {
        zFlips.push({t: cur.t, key, what: `z ${prev.z} → ${cur.z} at scale ${cur.scale}`});
      }
    }
    const h = handoff.find((x) => x.key === key);
    if (h !== undefined && coexistFrom !== undefined) {
      h.coexistMs = coexistTo - coexistFrom;
    }
  }
  const scrollJumps: Array<FocusFinding> = [];
  for (let i = 1; i < scroll.length; i++) {
    const [t0, a] = scroll[i - 1];
    const [t1, b] = scroll[i];
    if (Math.abs(b - a) > 24 * uiScale && t1 - t0 <= 20) {
      scrollJumps.push({t: t1, key: 'scroll', what: `scroll ${a} → ${b} in ${t1 - t0} ms`});
    }
  }
  return {
    samples: samples.length,
    ringed: [...byKey.keys()].filter((k) => full[k] > 0),
    full, snaps, bornHidden, jumps, scrollJumps, zFlips, handoff, arrivalMs,
    longTasks: [...long],
    trail: [...samples],
  };
}

/** A one-line summary for a test message / a stand log. */
export function focusWitnessSummary(r: FocusWitnessReport): string {
  const n = (a: ReadonlyArray<unknown>) => a.length;
  return `samples ${r.samples} · ringed ${r.ringed.join(',')} · snaps ${n(r.snaps)} · bornHidden ${n(r.bornHidden)} · jumps ${n(r.jumps)} · ` +
    `scrollJumps ${n(r.scrollJumps)} · zFlips ${n(r.zFlips)} · handoff ${JSON.stringify(r.handoff)} · arrival ${JSON.stringify(r.arrivalMs)} · ` +
    `long ${JSON.stringify(r.longTasks)}`;
}

/** The trail around a finding, for the red's message. */
export function focusTrailAround(r: FocusWitnessReport, t: number, key: string, span = 60): string {
  return r.trail.filter((s) => s.key === key && Math.abs(s.t - t) <= span)
    .map((s) => `${String(s.t).padStart(5)} ring ${s.ring} vis ${s.vis} scale ${s.scale} z ${s.z} box ${JSON.stringify(s.box)}${s.animating ? ' anim' : ''}${s.proxy !== undefined ? ` proxy ${JSON.stringify(s.proxy)}` : ''}`)
    .join('\n');
}
