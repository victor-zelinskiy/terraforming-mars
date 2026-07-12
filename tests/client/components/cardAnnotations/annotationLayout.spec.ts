import {expect} from 'chai';
import {
  solveAnnotationLayout,
  routeTether,
  AnnotationPlacement,
  LayoutInput,
  LayoutItem,
  TetherRect,
  ANNOTATION_MAX_W,
} from '@/client/components/cardAnnotations/annotationLayout';

const VIEWPORT = {width: 1600, height: 900};
// A centred fullscreen card: generous ~490px gutters on both sides.
const CARD = {left: 620, right: 980, top: 120, bottom: 780};

function input(items: Array<LayoutItem>, overrides: Partial<LayoutInput> = {}): LayoutInput {
  return {items, cardRect: CARD, viewport: VIEWPORT, edgePad: 24, ...overrides};
}

function item(id: string, anchorY: number, height = 60): LayoutItem {
  return {id, anchorY, height};
}

function bySide(placements: ReadonlyArray<AnnotationPlacement>) {
  return {
    left: placements.filter((p) => p.side === 'left'),
    right: placements.filter((p) => p.side === 'right'),
  };
}

describe('annotationLayout', () => {
  it('returns null for an empty item list', () => {
    expect(solveAnnotationLayout(input([]))).to.eq(null);
  });

  it('returns null when the gutters are too narrow for a readable block', () => {
    // Card nearly spans the viewport — ~60px gutters < MIN_W + gaps.
    const layout = solveAnnotationLayout(input(
      [item('a', 300)],
      {cardRect: {left: 60, right: VIEWPORT.width - 60, top: 100, bottom: 800}},
    ));
    expect(layout).to.eq(null);
  });

  it('caps the block width and places every item', () => {
    const layout = solveAnnotationLayout(input([item('a', 200), item('b', 400), item('c', 600)]));
    expect(layout).to.not.eq(null);
    expect(layout!.width).to.eq(ANNOTATION_MAX_W); // wide gutters → the cap
    expect(layout!.placements.map((p) => p.id).sort()).to.deep.eq(['a', 'b', 'c']);
  });

  it('alternates FREE items across sides by anchor order (first → right)', () => {
    const layout = solveAnnotationLayout(input([
      item('top', 200), item('mid', 400), item('low', 600), item('bottom', 700),
    ]))!;
    const sides = new Map(layout.placements.map((p) => [p.id, p.side]));
    expect(sides.get('top')).to.eq('right');
    expect(sides.get('mid')).to.eq('left');
    expect(sides.get('low')).to.eq('right');
    expect(sides.get('bottom')).to.eq('left');
  });

  it('honours the anchor-side bias (block beside the element it explains)', () => {
    const layout = solveAnnotationLayout(input([
      {id: 'l1', anchorY: 300, height: 60, bias: 'left'},
      {id: 'l2', anchorY: 500, height: 60, bias: 'left'},
      {id: 'r1', anchorY: 400, height: 60, bias: 'right'},
      {id: 'free', anchorY: 600, height: 60, bias: 'free'},
    ]))!;
    const sides = new Map(layout.placements.map((p) => [p.id, p.side]));
    expect(sides.get('l1')).to.eq('left');
    expect(sides.get('l2')).to.eq('left');
    expect(sides.get('r1')).to.eq('right');
    expect(sides.get('free')).to.eq('right'); // fills the lighter side
  });

  it('vertical order per side mirrors the anchors (biased case)', () => {
    const layout = solveAnnotationLayout(input([
      {id: 'b', anchorY: 620, height: 70, bias: 'left'},
      {id: 'a', anchorY: 240, height: 70, bias: 'left'},
      {id: 'm', anchorY: 430, height: 70, bias: 'left'},
    ]))!;
    const left = layout.placements.filter((p) => p.side === 'left');
    const orderById = left.sort((x, y) => x.y - y.y).map((p) => p.id);
    expect(orderById).to.deep.eq(['a', 'm', 'b']);
  });

  it('bottom-clamped blocks push earlier ones up instead of overlapping', () => {
    // Both anchored at the very bottom of the SAME side: the naive clamp
    // used to park them on the same y — the two-pass pack must separate.
    const layout = solveAnnotationLayout(input([
      {id: 'p', anchorY: 850, height: 90, bias: 'right'},
      {id: 'q', anchorY: 860, height: 90, bias: 'right'},
    ]))!;
    const right = layout.placements.filter((p) => p.side === 'right').sort((a, b) => a.y - b.y);
    expect(right).to.have.length(2);
    expect(right[1].y - right[0].y).to.be.gte(90 + 18);
    expect(right[1].y + 90).to.be.lte(VIEWPORT.height - 78);
  });

  it('pins block x to the card edge gap per side', () => {
    const layout = solveAnnotationLayout(input([item('r', 300), item('l', 500)]))!;
    const {left, right} = bySide(layout.placements);
    expect(right[0].x).to.eq(CARD.right + 30);
    expect(left[0].x).to.eq(CARD.left - 30 - layout.width);
  });

  it('never overlaps blocks on a side (min 12px gap, anchor order kept)', () => {
    // All anchors bunched together — same side items must be pushed apart.
    const layout = solveAnnotationLayout(input([
      item('a', 400, 90), item('b', 405, 90), item('c', 410, 90), item('d', 415, 90),
    ]))!;
    for (const side of Object.values(bySide(layout.placements))) {
      const ys = side.map((p) => p.y);
      expect(ys).to.deep.eq([...ys].sort((a, b) => a - b)); // anchor order kept
      for (let i = 1; i < side.length; i++) {
        expect(side[i].y - side[i - 1].y).to.be.gte(90 + 12);
      }
    }
  });

  it('clamps blocks into the safe vertical band', () => {
    const layout = solveAnnotationLayout(input([item('hi', -200, 80), item('lo', 2000, 80)]))!;
    for (const p of layout.placements) {
      expect(p.y).to.be.gte(18); // SAFE_TOP
      expect(p.y + 80).to.be.lte(VIEWPORT.height - 78); // SAFE_BOTTOM
    }
  });

  it('flags compact mode for dense cards (> 5 blocks) and keeps them all', () => {
    const items = Array.from({length: 7}, (_, i) => item(`b${i}`, 150 + i * 90, 70));
    const layout = solveAnnotationLayout(input(items))!;
    expect(layout.compact).to.eq(true);
    expect(layout.placements).to.have.length(7);
  });

  it('rebalances an overflowing side to the lighter one', () => {
    // 6 tall blocks: naive round-robin puts 3×300 = 900 + gaps > capacity
    // (~804) on each side; the solver must hand tails across so both sides
    // stay within the viewport band as far as geometrically possible.
    const items = Array.from({length: 6}, (_, i) => item(`t${i}`, 100 + i * 120, 300));
    const layout = solveAnnotationLayout(input(items))!;
    expect(layout.placements).to.have.length(6);
    const {left, right} = bySide(layout.placements);
    expect(left.length).to.be.gte(1);
    expect(right.length).to.be.gte(1);
  });
});

function parsePath(d: string): Array<[number, number]> {
  return d
    .split(/[ML]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      const [x, y] = s.split(/\s+/).map(Number);
      return [x, y] as [number, number];
    });
}

/** Densely samples the polyline; true if any point falls strictly inside the rect. */
function pathEntersRect(d: string, r: TetherRect): boolean {
  const pts = parsePath(d);
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1];
    const [x2, y2] = pts[i];
    for (let t = 0; t <= 60; t++) {
      const x = x1 + ((x2 - x1) * t) / 60;
      const y = y1 + ((y2 - y1) * t) / 60;
      if (x > r.left && x < r.right && y > r.top && y < r.bottom) {
        return true;
      }
    }
  }
  return false;
}

describe('routeTether', () => {
  // A last mechanics row anchored low, a block in the left gutter, and the two
  // bottom-left service elements right under the trace's path.
  const anchor: TetherRect = {left: 860, right: 1120, top: 1070, bottom: 1110};
  const stamp: TetherRect = {left: 812, right: 826, top: 1104, bottom: 1118};
  const counter: TetherRect = {left: 826, right: 872, top: 1101, bottom: 1119};

  it('keeps the elegant elbow when nothing is in the way', () => {
    const {d} = routeTether({bx: 560, by: 1090, anchor, side: 'left', obstacles: []});
    // default = M start L elbow L anchor (exactly two segments)
    expect(parsePath(d)).to.have.length(3);
  });

  it('a clear obstacle far from the trace does not perturb the elbow', () => {
    const far: TetherRect = {left: 200, right: 240, top: 300, bottom: 320};
    const {d} = routeTether({bx: 560, by: 1090, anchor, side: 'left', obstacles: [far]});
    expect(parsePath(d)).to.have.length(3);
  });

  it('re-routes so the trace never crosses the stamp or the counter', () => {
    const {d, ax, ay} = routeTether({
      bx: 560, by: 1090, anchor, side: 'left', obstacles: [stamp, counter],
    });
    expect(pathEntersRect(d, stamp), 'stamp').to.eq(false);
    expect(pathEntersRect(d, counter), 'counter').to.eq(false);
    // the endpoint still lands ON the anchor it explains
    expect(ax).to.be.within(anchor.left - 8, anchor.right);
    expect(ay).to.be.within(anchor.top - 2, anchor.bottom);
  });

  it('slides the endpoint clear when the near edge sits over a service element', () => {
    // anchor's near (left) edge overlaps the counter → the drop-x must move
    // off it, kept within the anchor's own width.
    const wide: TetherRect = {left: 840, right: 1160, top: 1070, bottom: 1110};
    const over: TetherRect = {left: 820, right: 872, top: 1095, bottom: 1120};
    const {d, ax} = routeTether({bx: 560, by: 1090, anchor: wide, side: 'left', obstacles: [over]});
    expect(pathEntersRect(d, over)).to.eq(false);
    expect(ax).to.be.greaterThan(over.right); // dropped to the right of the element
    expect(ax).to.be.lessThan(wide.right);
  });
});
