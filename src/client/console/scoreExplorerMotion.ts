/*
 * SCORE EXPLORER MOTION — the shared-element handoff between the summary's
 * VP tile and the score explorer (both directions), plus the overview grid's
 * unfold out of the legend it grew from.
 *
 * THE PHYSICALITY CONTRACT (the whole point of this module): the TOTAL and
 * the SEGMENTED BAR are the same objects on both sides of the transition —
 * they may not vanish for a frame, may not exist twice, and must land
 * exactly where the destination draws them. The zone swap is Vue's `out-in`
 * (a gap frame is structural), so the continuity is carried by PROXIES:
 *
 *   ARM  (the leaving side's transition hook): clone `[data-vpx-total]` +
 *        `[data-vpx-bar]`, seat the clones on a fixed layer inside
 *        `.con-root` at their raw source rects, hide the originals under
 *        them (identical copies — the handoff rule);
 *   FLY  (the entering side's hook): hide the destination originals, FLIP
 *        the proxies onto the freshly measured destination rects while the
 *        grid unfolds from the legend's armed rect and the tiles cascade;
 *   LAND: reveal the destination originals, remove the proxies on the NEXT
 *        frame — reveal-then-remove, never a crossfade, never a blank frame.
 *
 * Every interruption path (B mid-flight, a second press, unmount) funnels
 * into `disposeScoreHandoff()`, which restores anything hidden and drops the
 * layer — an aborted episode can never strand an invisible total.
 *
 * Reduced motion: `armScoreHandoff` refuses, so the zone swap falls back to
 * the workspace's ordinary reduced-motion snap.
 */
import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {descendCascade, descendUnfold} from '@/client/console/surfaceMotion/workspaceDescend';

const FRESH_MS = 900;

type Rect = {left: number, top: number, width: number, height: number};

type ArmedProxy = {
  proxy: HTMLElement,
  rect: Rect,
  /** The hidden source original — restored on dispose (an aborted leave). */
  source: HTMLElement,
};

type ArmedHandoff = {
  total: ArmedProxy | undefined,
  bar: ArmedProxy | undefined,
  /** The legend/grid block's rect — the unfold origin for the other side. */
  blockRect: Rect | undefined,
  at: number,
};

let armed: ArmedHandoff | undefined;
let layer: HTMLElement | undefined;
/** The entering side's originals hidden for the flight (revealed on land). */
let hiddenTargets: Array<HTMLElement> = [];

function ensureLayer(): HTMLElement {
  if (layer !== undefined && layer.isConnected) {
    return layer;
  }
  const host = document.querySelector('.con-root') ?? document.body;
  const el = document.createElement('div');
  el.className = 'con-vpx-fx';
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:11570;';
  host.appendChild(el);
  layer = el;
  return el;
}

function rectOf(el: Element | null): Rect | undefined {
  const r = el?.getBoundingClientRect();
  return r === undefined || r.width < 4 || r.height < 4 ?
    undefined : {left: r.left, top: r.top, width: r.width, height: r.height};
}

function makeProxy(source: HTMLElement, rect: Rect): ArmedProxy {
  const proxy = source.cloneNode(true) as HTMLElement;
  proxy.style.position = 'fixed';
  proxy.style.left = `${rect.left}px`;
  proxy.style.top = `${rect.top}px`;
  proxy.style.width = `${rect.width}px`;
  proxy.style.height = `${rect.height}px`;
  proxy.style.margin = '0';
  proxy.style.transformOrigin = 'top left';
  // The clone must paint EXACTLY the pixels the original paints — insurance
  // for inherited text metrics the class alone may not carry off-tree.
  const cs = getComputedStyle(source);
  proxy.style.font = cs.font;
  proxy.style.letterSpacing = cs.letterSpacing;
  proxy.style.color = cs.color;
  proxy.style.display = cs.display;
  proxy.style.alignItems = cs.alignItems;
  proxy.style.gap = cs.gap;
  ensureLayer().appendChild(proxy);
  source.style.visibility = 'hidden';
  return {proxy, rect, source};
}

/**
 * ARM the handoff on the LEAVING side. Returns false (and arms nothing)
 * under reduced motion or when the host carries no shared elements.
 */
export function armScoreHandoff(leavingHost: HTMLElement): boolean {
  if (consoleReducedMotionActive()) {
    return false;
  }
  disposeScoreHandoff();
  const totalEl = leavingHost.querySelector<HTMLElement>('[data-vpx-total]');
  const barEl = leavingHost.querySelector<HTMLElement>('[data-vpx-bar]');
  const totalRect = rectOf(totalEl);
  const barRect = rectOf(barEl);
  if (totalRect === undefined && barRect === undefined) {
    return false;
  }
  armed = {
    total: totalEl !== null && totalRect !== undefined ? makeProxy(totalEl, totalRect) : undefined,
    bar: barEl !== null && barRect !== undefined ? makeProxy(barEl, barRect) : undefined,
    blockRect: rectOf(leavingHost.querySelector<HTMLElement>('[data-vpx-block]')),
    at: Date.now(),
  };
  return true;
}

export function scoreHandoffArmed(): boolean {
  return armed !== undefined && Date.now() - armed.at <= FRESH_MS;
}

/**
 * FLY the armed proxies onto the ENTERING side's own shared elements, unfold
 * `[data-vpx-block]` from the armed block rect and cascade `cascade`.
 * Returns false when nothing was armed — the caller falls back to its
 * ordinary entrance. `done` fires exactly once (completion or safety).
 */
export function playScoreHandoff(
  enteringHost: HTMLElement,
  cascade: ReadonlyArray<HTMLElement>,
  done: () => void,
): boolean {
  if (!scoreHandoffArmed() || armed === undefined) {
    disposeScoreHandoff();
    return false;
  }
  const episode = armed;
  armed = undefined;

  let finished = false;
  let safety = 0;
  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    window.clearTimeout(safety);
    // LAND: reveal the destination originals, drop the proxies NEXT frame —
    // the copies are identical, so one frame of overlap is invisible and a
    // blank frame is impossible.
    for (const el of hiddenTargets) {
      el.style.visibility = '';
    }
    hiddenTargets = [];
    requestAnimationFrame(() => {
      episode.total?.proxy.remove();
      episode.bar?.proxy.remove();
      episode.total?.source.style.removeProperty('visibility');
      episode.bar?.source.style.removeProperty('visibility');
    });
    done();
  };

  const tl = gsap.timeline({onComplete: finish});
  const flyMs = motionMs(320) / 1000;

  const flights: Array<{p: ArmedProxy, dest: Rect, uniform: boolean}> = [];
  const totalDest = rectOf(enteringHost.querySelector<HTMLElement>('[data-vpx-total]'));
  const barDest = rectOf(enteringHost.querySelector<HTMLElement>('[data-vpx-bar]'));
  if (episode.total !== undefined && totalDest !== undefined) {
    flights.push({p: episode.total, dest: totalDest, uniform: true});
  }
  if (episode.bar !== undefined && barDest !== undefined) {
    flights.push({p: episode.bar, dest: barDest, uniform: false});
  }
  for (const f of flights) {
    const destEl = f.uniform ?
      enteringHost.querySelector<HTMLElement>('[data-vpx-total]') :
      enteringHost.querySelector<HTMLElement>('[data-vpx-bar]');
    if (destEl !== null) {
      destEl.style.visibility = 'hidden';
      hiddenTargets.push(destEl);
    }
    // A text block scales UNIFORMLY (same glyphs, proportional metrics); the
    // bar is a rect and takes each axis on its own.
    const vars: gsap.TweenVars = {
      x: f.dest.left - f.p.rect.left,
      y: f.dest.top - f.p.rect.top,
      duration: flyMs,
      ease: 'expo.out',
    };
    if (f.uniform) {
      vars.scale = f.dest.height / f.p.rect.height;
    } else {
      vars.scaleX = f.dest.width / f.p.rect.width;
      vars.scaleY = f.dest.height / f.p.rect.height;
    }
    tl.to(f.p.proxy, vars, 0);
  }

  // The categories OPEN OUT OF the compact block they were just read as.
  const block = enteringHost.querySelector<HTMLElement>('[data-vpx-block]');
  if (block !== null && episode.blockRect !== undefined) {
    descendUnfold(tl, block, episode.blockRect, motionMs(300) / 1000, motionMs(30) / 1000);
  }
  if (cascade.length > 0) {
    descendCascade(tl, cascade, motionMs(190) / 1000, motionMs(120) / 1000, 0.028);
  }
  if (flights.length === 0 && block === null && cascade.length === 0) {
    finish();
    return true;
  }
  safety = window.setTimeout(finish, motionMs(700) + 450);
  return true;
}

/** Kill everything, restore every hidden node — safe from any state. */
export function disposeScoreHandoff(): void {
  if (armed !== undefined) {
    for (const p of [armed.total, armed.bar]) {
      if (p !== undefined) {
        gsap.killTweensOf(p.proxy);
        p.proxy.remove();
        p.source.style.removeProperty('visibility');
      }
    }
    armed = undefined;
  }
  for (const el of hiddenTargets) {
    el.style.removeProperty('visibility');
  }
  hiddenTargets = [];
  if (layer !== undefined) {
    for (const child of Array.from(layer.children)) {
      gsap.killTweensOf(child);
      child.remove();
    }
  }
}
