/*
 * @console-shared LIVE — console native stands on this file.
 *
 * LANDING GEOMETRY — the ONE answer to «where will this element REST?».
 *
 * Every flight in this console aims a proxy at a real element's rect and
 * hands off on touchdown. When the measured element (or an ANCESTOR zone it
 * sits in) is itself mid-entry — a `con-start-deal` translateY, an embed
 * zone's `con-start-embed-in` translate+scale, a discard tray's `both`-filled
 * rise, a descend cascade's GSAP y-offset — a raw `getBoundingClientRect()`
 * returns a rect that is STILL MOVING, the whole flight aims at a place the
 * slot is only passing through, and the handoff snaps the visible card by the
 * remaining travel (measured in production: 26×9 px at 1080, 61×18 px at 4K).
 *
 * `restingRectOf(el)` returns the rect the element will occupy AT REST:
 *
 *  1. For the element ITSELF, a computed transform that is a PURE TRANSLATION
 *     is subtracted unconditionally — this covers GSAP inline tweens (which
 *     `getAnimations` cannot see) and is the exact behaviour the original
 *     `workspaceDescend.restingRectOf` shipped with. Scale / rotation /
 *     authored matrices are left alone: subtracting them would aim at a box
 *     that does not exist.
 *  2. For the element AND each ancestor, a LIVE CSS animation/transition that
 *     is currently driving `transform` (via `getAnimations({subtree:false})`)
 *     is un-mapped toward its OWN END state — its last keyframe's transform
 *     (`none`/identity for every entry animation; the destination offset for
 *     a retargeted transition, e.g. the hand album's page glide, which makes
 *     a mid-turn measure aim at the page's FINAL berth). Translation is
 *     origin-free and exact; scale is un-mapped about the element's centre
 *     (every entry in this codebase keeps the default `50% 50%` origin);
 *     rotation-bearing matrices are skipped — no landing zone rotates.
 *
 * STATIC positional transforms — `translate(-50%)` centring, the album's
 * page-strip berth — have no live animation and are therefore never touched:
 * they are layout, not motion. That is the property that makes this safe to
 * apply at every measure site.
 *
 * DOM-optional: under JSDOM (no `getAnimations`, no `DOMMatrixReadOnly`) it
 * degrades to the raw rect, exactly like the original.
 */

export type LandingRect = {left: number, top: number, width: number, height: number};

/** How far up the tree live-animated ancestors are looked for. Landing slots
 *  sit at most a few zones deep inside their workspace; a bound keeps the
 *  cost of one measure independent of document depth. */
const ANCESTOR_WALK_CAP = 14;

function isIdentity(m: DOMMatrixReadOnly): boolean {
  return Math.abs(m.a - 1) < 0.001 && Math.abs(m.d - 1) < 0.001 &&
    Math.abs(m.b) < 0.001 && Math.abs(m.c) < 0.001 &&
    Math.abs(m.e) < 0.5 && Math.abs(m.f) < 0.5;
}

function isPureTranslation(m: DOMMatrixReadOnly): boolean {
  return m.is2D &&
    Math.abs(m.a - 1) < 0.001 && Math.abs(m.d - 1) < 0.001 &&
    Math.abs(m.b) < 0.001 && Math.abs(m.c) < 0.001;
}

/** A 2D affine this module can invert (non-degenerate linear part). The dock
 *  pack's pose ride carries a TILT, so rotation must be first-class — the
 *  translate+scale-only gate silently skipped every tilted back. */
function isInvertible2D(m: DOMMatrixReadOnly): boolean {
  return m.is2D && Math.abs(m.a * m.d - m.b * m.c) > 0.001;
}

function parseMatrix(raw: string | undefined | null): DOMMatrixReadOnly | undefined {
  if (raw === undefined || raw === null || raw === '' || raw === 'none') {
    return undefined;
  }
  try {
    return new DOMMatrixReadOnly(raw);
  } catch {
    return undefined;
  }
}

/**
 * The END-state transform of a live animation, when it can be read honestly:
 * the last keyframe's `transform` (an entry ends at `none`; a transition's
 * second keyframe IS its destination). `undefined` = the end state is not
 * readable (composite animations, missing keyframes) — the caller skips.
 */
function endMatrixOf(anim: Animation): DOMMatrixReadOnly | undefined | 'skip' {
  const effect = anim.effect;
  if (effect === null || typeof (effect as KeyframeEffect).getKeyframes !== 'function') {
    return 'skip';
  }
  let frames: Array<{transform?: unknown}>;
  try {
    frames = (effect as KeyframeEffect).getKeyframes() as Array<{transform?: unknown}>;
  } catch {
    return 'skip';
  }
  if (frames.length === 0) {
    return 'skip';
  }
  const touchesTransform = frames.some((f) => typeof f.transform === 'string');
  if (!touchesTransform) {
    return 'skip'; // opacity-only etc. — geometry is not this animation's business
  }
  const last = frames[frames.length - 1];
  const raw = typeof last.transform === 'string' ? last.transform : undefined;
  if (raw === undefined || raw === 'none') {
    return undefined; // ends at identity — the common entry shape
  }
  return parseMatrix(raw) ?? 'skip';
}

/** A live (running, or finished-but-filling) animation currently driving
 *  this element's transform, with a readable end state. */
function liveTransformAnimation(el: Element): {end: DOMMatrixReadOnly | undefined} | undefined {
  const withAnims = el as Element & {getAnimations?: (o?: {subtree?: boolean}) => Array<Animation>};
  if (typeof withAnims.getAnimations !== 'function') {
    return undefined;
  }
  let anims: Array<Animation>;
  try {
    anims = withAnims.getAnimations({subtree: false});
  } catch {
    return undefined;
  }
  for (const anim of anims) {
    // A finished animation without fill has already released the element;
    // a finished `both/forwards` fill applies its END frame — un-mapping
    // toward that same end state is then a no-op by construction.
    if (anim.playState !== 'running' && anim.playState !== 'finished') {
      continue;
    }
    const end = endMatrixOf(anim);
    if (end !== 'skip') {
      return {end};
    }
  }
  return undefined;
}

type Pt = {x: number, y: number};

/** The pure slice of a 2D affine this module reasons about. */
export type TransformLink = {
  /** The element's CURRENT computed matrix (full 2D linear part + translate). */
  cur: {a: number, b: number, c: number, d: number, e: number, f: number},
  /** The END-state matrix; `undefined` = identity (the entry shape). */
  end: {a: number, b: number, c: number, d: number, e: number, f: number} | undefined,
  /** The transform origin in viewport coordinates. */
  origin: Pt,
};

/**
 * Un-map a viewport point through ONE element's current transform into that
 * element's REST transform. Full 2D affine about the origin — the dock pack's
 * pose ride composes translate + scale + TILT, so rotation is first-class.
 * (Translation stays origin-free and exact; for rotation/scale the origin is
 * the element's centre, which every pose/entry in this codebase keeps — and a
 * centre origin is a fixed point of the linear part, so the same derivation
 * holds.) Pure — spec'd under the mochapack runner.
 */
export function unmapPoint(q: Pt, link: TransformLink): Pt {
  const {cur, end, origin} = link;
  // local = Mcur_lin⁻¹ · (q − O − t_cur)
  const relX = q.x - origin.x - cur.e;
  const relY = q.y - origin.y - cur.f;
  const det = cur.a * cur.d - cur.b * cur.c;
  const localX = (cur.d * relX - cur.c * relY) / det;
  const localY = (cur.a * relY - cur.b * relX) / det;
  if (end === undefined) {
    return {x: origin.x + localX, y: origin.y + localY};
  }
  // rest = O + Mend_lin · local + t_end
  return {
    x: origin.x + end.a * localX + end.c * localY + end.e,
    y: origin.y + end.b * localX + end.d * localY + end.f,
  };
}

/** Un-map a whole rect through a chain of transform links (outermost applied
 *  last — the walk order `restingRectOf` builds). The measured rect is the
 *  BOUNDING BOX of a possibly-rotated card, so all four corners travel and
 *  the result is their bounding box again. Pure. */
export function unmapRectThrough(
  rect: LandingRect, links: ReadonlyArray<TransformLink>,
): LandingRect {
  let box = rect;
  for (const link of links) {
    const corners = [
      unmapPoint({x: box.left, y: box.top}, link),
      unmapPoint({x: box.left + box.width, y: box.top}, link),
      unmapPoint({x: box.left, y: box.top + box.height}, link),
      unmapPoint({x: box.left + box.width, y: box.top + box.height}, link),
    ];
    const xs = corners.map((p) => p.x);
    const ys = corners.map((p) => p.y);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    box = {left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top};
  }
  return box;
}

/**
 * The rect `el` will occupy at REST — `getBoundingClientRect()` minus every
 * motion that is provably transient (see the module header). Safe on every
 * landing zone; degrades to the raw rect where nothing transient is found.
 */
export function restingRectOf(el: HTMLElement): LandingRect {
  const r = el.getBoundingClientRect();
  let box: LandingRect = {left: r.left, top: r.top, width: r.width, height: r.height};
  if (typeof window === 'undefined' || typeof DOMMatrixReadOnly === 'undefined') {
    return box;
  }

  // ── 1) the element's OWN inline pure translation (the GSAP case) ──────────
  // Skipped when a live CSS animation drives the element — the animation OWNS
  // the computed transform then, and step 2 un-maps it exactly.
  const selfAnim = liveTransformAnimation(el);
  if (selfAnim === undefined) {
    const own = parseMatrix(window.getComputedStyle(el).transform);
    if (own !== undefined && isPureTranslation(own)) {
      box = {left: box.left - own.e, top: box.top - own.f, width: box.width, height: box.height};
    }
  }

  // ── 2) live CSS animations/transitions on self + ancestors ────────────────
  let node: HTMLElement | null = el;
  for (let depth = 0; node !== null && node !== document.documentElement && depth < ANCESTOR_WALK_CAP; depth++, node = node.parentElement) {
    const live = node === el ? selfAnim : liveTransformAnimation(node);
    if (live === undefined) {
      continue;
    }
    const cur = parseMatrix(window.getComputedStyle(node).transform);
    if (cur === undefined || isIdentity(cur)) {
      continue; // already at rest this frame (or unreadable) — nothing to undo
    }
    if (!isInvertible2D(cur) || (live.end !== undefined && !live.end.is2D)) {
      continue; // 3D / degenerate — leave as measured
    }
    // ORIGIN. Translation is origin-free (exact). For the linear part:
    //  · a TRANSLATE+SCALE node (no rotation) gets the EXACT declared origin —
    //    resolved from the computed `transform-origin` via the mapped top-left
    //    corner (for an axis-aligned matrix the rect's top-left IS the mapped
    //    local (0,0), so the untransformed box position falls out exactly).
    //    The dock PACK scales about `50% 100%` (the tray axis) — the centre
    //    assumption there produced garbage berths;
    //  · a ROTATING node falls back to the centre, which is what our rotating
    //    elements (the pack's tilted cards) actually declare — a centre origin
    //    is a fixed point of the linear part, so the transformed box's centre
    //    relates to it by the matrix's own translation alone.
    const nodeRect = node.getBoundingClientRect();
    const axisAligned = Math.abs(cur.b) < 0.001 && Math.abs(cur.c) < 0.001;
    let origin: Pt = {
      x: (nodeRect.left + nodeRect.right) / 2 - cur.e,
      y: (nodeRect.top + nodeRect.bottom) / 2 - cur.f,
    };
    if (axisAligned) {
      const rawOrigin = window.getComputedStyle(node).transformOrigin;
      const parts = rawOrigin.split(' ').map((v) => Number.parseFloat(v));
      if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
        const ox = parts[0];
        const oy = parts[1];
        // rect.topLeft = B + (I−M_lin)·(ox,oy) + t  ⇒  B, then O = B + (ox,oy).
        const bx = nodeRect.left - ((1 - cur.a) * ox + cur.e);
        const by = nodeRect.top - ((1 - cur.d) * oy + cur.f);
        origin = {x: bx + ox, y: by + oy};
      }
    }
    box = unmapRectThrough(box, [{
      cur: {a: cur.a, b: cur.b, c: cur.c, d: cur.d, e: cur.e, f: cur.f},
      end: live.end === undefined ? undefined :
        {a: live.end.a, b: live.end.b, c: live.end.c, d: live.end.d, e: live.end.e, f: live.end.f},
      origin,
    }]);
  }
  return box;
}
