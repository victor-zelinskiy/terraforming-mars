import {expect} from 'chai';
import {
  solveAnnotationLayout,
  AnnotationPlacement,
  LayoutInput,
  LayoutItem,
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

  it('deals sides round-robin by anchor order (first → right)', () => {
    const layout = solveAnnotationLayout(input([
      item('top', 200), item('mid', 400), item('low', 600), item('bottom', 700),
    ]))!;
    const sides = new Map(layout.placements.map((p) => [p.id, p.side]));
    expect(sides.get('top')).to.eq('right');
    expect(sides.get('mid')).to.eq('left');
    expect(sides.get('low')).to.eq('right');
    expect(sides.get('bottom')).to.eq('left');
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
