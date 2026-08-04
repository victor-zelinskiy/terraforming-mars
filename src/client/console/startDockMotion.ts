/*
 * startDockMotion — the SELECTION DOCK flights of the Game Start Workspace.
 *
 * Three physical movements, one proxy discipline (the shared FaceLite + flip
 * chassis every console flight uses — one object, never a lookalike):
 *
 *  - COLLECT  (RT, step → next step): the step's SELECTED cards separate from
 *    their grid slots, turn face-down mid-arc and settle onto their pile in
 *    the Selection Dock — a short, decisive gather (the step advances under
 *    the flight, so the pane swap is covered by the moving cards);
 *  - RETURN   (LT, step ← previous step): the SAME cards rise out of their
 *    pile, turn face-up and land back into their reserved grid slots (held
 *    empty until each touchdown — the table the player left, restored);
 *  - REVEAL   (the Summary): every pile opens — the cards fly from the piles
 *    into their summary tiles, face-up (the prepared set laid out for the
 *    final look), and fly BACK into the piles when the summary is left.
 *
 * DOM/GSAP only; the host owns state and calls these around its own step
 * changes. Every entry point resolves (guarded budgets, degenerate-geometry
 * fallbacks) — a lost element can never wedge the wizard.
 */
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';

export type DockFlightSource = {name: CardName, el: HTMLElement};

type Rect = {x: number, y: number, w: number, h: number};

/** Flight timing (ms @ motion scale 1) — short and decisive, never a parade. */
const FLIGHT_MS = 320;
const STAGGER_MS = 55;
/** The pile's press when a card lands (px @ uiScale 1 — the host scales). */
export const DOCK_PRESS_PX = 2;

let layerEl: HTMLElement | undefined;

/** The scene mounts ONE fixed proxy layer and registers it here. */
export function registerStartDockLayer(el: HTMLElement | undefined): void {
  layerEl = el ?? undefined;
}

function rectOf(el: HTMLElement | null | undefined): Rect | undefined {
  const r = el?.getBoundingClientRect?.();
  return r !== undefined && r.width > 4 && r.height > 4 ?
    {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
}

/** Spawn one flip-chassis proxy (face + back) on the layer, over `from`. */
function spawnProxy(name: CardName, from: Rect, faceUp: boolean): HTMLElement | undefined {
  if (layerEl === undefined || !layerEl.isConnected) {
    return undefined;
  }
  const proxy = document.createElement('div');
  proxy.className = 'con-startdock-proxy';
  proxy.innerHTML =
    `<div class="con-deal-proxy__flip">` +
      `<div class="con-deal-proxy__face" data-dock-face="${name}"></div>` +
      `<div class="con-deal-proxy__back"><div class="con-card-back con-card-back--flyer"></div></div>` +
    `</div>`;
  layerEl.appendChild(proxy);
  gsap.set(proxy, {x: from.x, y: from.y, width: from.w, height: from.h, transformOrigin: '0 0'});
  const flip = proxy.querySelector<HTMLElement>('.con-deal-proxy__flip');
  if (flip !== null) {
    gsap.set(flip, {rotationY: faceUp ? 0 : 180});
  }
  return proxy;
}

/** The face content: the REAL rendered face is snapshotted by cloning the
 *  source card's node — the proxy is the same pixels the slot showed (the
 *  premium face is static, so a clone is exact and costs no remount). */
function fillFace(proxy: HTMLElement, sourceCard: HTMLElement | undefined): void {
  const face = proxy.querySelector<HTMLElement>('.con-deal-proxy__face');
  if (face === null || sourceCard === undefined) {
    return;
  }
  const clone = sourceCard.cloneNode(true) as HTMLElement;
  clone.style.margin = '0';
  // The slot renders the face through a CSS zoom — carry it onto the clone so
  // the proxy's first frame is the same pixels the slot showed.
  const zoom = getComputedStyle(sourceCard).zoom;
  if (zoom !== '' && zoom !== 'normal' && zoom !== '1') {
    (clone.style as unknown as {zoom: string}).zoom = zoom;
  }
  face.appendChild(clone);
}

function guarded(run: (done: () => void) => void, budgetMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        window.clearTimeout(safety);
        resolve();
      }
    };
    const safety = window.setTimeout(done, budgetMs + 1400);
    run(done);
  });
}

function clearLayer(): void {
  if (layerEl !== undefined) {
    layerEl.innerHTML = '';
  }
}

/**
 * COLLECT: the selected cards fly from their slots onto the dock pile,
 * flipping face-down mid-arc. `onCovered` fires the moment every source is
 * covered by its proxy (the host may swap panes / hide the sources there);
 * resolves at the last touchdown (the host then reveals the pile count).
 */
export async function collectToDock(
  sources: ReadonlyArray<DockFlightSource>,
  pileEl: HTMLElement | null | undefined,
  onCovered?: () => void,
): Promise<void> {
  const pile = rectOf(pileEl);
  const live = sources
    .map((s) => ({name: s.name, el: s.el, from: rectOf(s.el), card: s.el.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? undefined}))
    .filter((s): s is typeof s & {from: Rect} => s.from !== undefined);
  if (pile === undefined || live.length === 0 || consoleReducedMotionActive() || layerEl === undefined) {
    onCovered?.();
    return;
  }
  const proxies = live.map((s) => {
    const p = spawnProxy(s.name, s.from, true);
    if (p !== undefined) {
      fillFace(p, s.card);
    }
    return p;
  });
  onCovered?.();
  const dur = motionMs(FLIGHT_MS) / 1000;
  await guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    proxies.forEach((proxy, i) => {
      if (proxy === undefined) {
        return;
      }
      const at = (motionMs(STAGGER_MS) * i) / 1000;
      const flip = proxy.querySelector<HTMLElement>('.con-deal-proxy__flip');
      const src = live[i];
      // Fit INTO the pile box by SCALE (the clone keeps its own pixels).
      tl.to(proxy, {
        x: pile.x, y: pile.y, scale: pile.w / src.from.w,
        duration: dur, ease: 'power2.inOut',
      }, at);
      if (flip !== null) {
        tl.to(flip, {rotationY: 180, duration: dur * 0.7, ease: 'power1.inOut'}, at + dur * 0.15);
      }
      tl.to(proxy, {autoAlpha: 0, duration: 0.09}, at + dur);
    });
  }, motionMs(FLIGHT_MS + STAGGER_MS * proxies.length) + 200);
  clearLayer();
}

/**
 * RETURN / REVEAL: cards fly OUT of a pile into their target slots, flipping
 * face-up. The targets stay held (invisible) under the proxies; `onLanded`
 * fires per card at its touchdown — the host reveals that slot in the same
 * frame (proxy → real card, pixel-true).
 */
export async function returnFromDock(
  names: ReadonlyArray<CardName>,
  pileEl: HTMLElement | null | undefined,
  slotFor: (name: CardName) => HTMLElement | null,
  onLanded?: (name: CardName) => void,
): Promise<void> {
  const pile = rectOf(pileEl);
  const targets = names
    .map((name) => {
      const slot = slotFor(name);
      const card = slot?.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? undefined;
      return {name, to: rectOf(card ?? slot ?? undefined), card};
    })
    .filter((t): t is typeof t & {to: Rect} => t.to !== undefined);
  if (pile === undefined || targets.length === 0 || consoleReducedMotionActive() || layerEl === undefined) {
    names.forEach((n) => onLanded?.(n));
    return;
  }
  // The proxy is born at the TARGET's natural size, scaled down into the
  // pile — its outbound tween simply scales back to 1 (pixel-true landing).
  const proxies = targets.map((t) => {
    const p = spawnProxy(t.name, {x: pile.x, y: pile.y, w: t.to.w, h: t.to.h}, false);
    if (p !== undefined) {
      fillFace(p, t.card);
      gsap.set(p, {scale: pile.w / Math.max(1, t.to.w)});
    }
    return p;
  });
  const dur = motionMs(FLIGHT_MS) / 1000;
  await guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    targets.forEach((t, i) => {
      const proxy = proxies[i];
      if (proxy === undefined) {
        onLanded?.(t.name);
        return;
      }
      const at = (motionMs(STAGGER_MS) * i) / 1000;
      const flip = proxy.querySelector<HTMLElement>('.con-deal-proxy__flip');
      tl.to(proxy, {
        x: t.to.x, y: t.to.y, scale: 1,
        duration: dur, ease: 'power2.inOut',
      }, at);
      if (flip !== null) {
        tl.to(flip, {rotationY: 0, duration: dur * 0.7, ease: 'power1.inOut'}, at + dur * 0.1);
      }
      tl.call(() => onLanded?.(t.name), undefined, at + dur);
      tl.to(proxy, {autoAlpha: 0, duration: 0.1}, at + dur + 0.02);
    });
  }, motionMs(FLIGHT_MS + STAGGER_MS * targets.length) + 260);
  clearLayer();
}

/** Abort/unmount: drop every proxy (idempotent). */
export function resetStartDockMotion(): void {
  if (layerEl !== undefined) {
    gsap.killTweensOf(layerEl.querySelectorAll('.con-startdock-proxy, .con-deal-proxy__flip'));
    clearLayer();
  }
}
