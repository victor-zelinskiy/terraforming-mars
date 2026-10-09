import {expect} from 'chai';
import {actionDescTier, DESC_FIT_ATTR, fitDescTiers, nextDescTier, renderedDescTier} from '@/client/console/descTier';

/*
 * THE CAPTION'S TIER, FITTED TO ITS COLUMN (PL-123). jsdom has no layout, so
 * each caption here carries its own geometry: how many lines its text takes
 * at each tier's face in THIS column, and the clamp of each tier — the
 * element reports `clientHeight` (clamped) and `scrollHeight` (whole) off
 * whatever tier it currently renders, exactly what the fit reads.
 */
const PREFIX = 'con-efx__desc';
const LH = 10;
const CLAMP = {brief: 2, regular: 2, dense: 3} as const;

function caption(ladder: 'brief' | 'regular' | 'dense', lines: {brief: number, regular: number, dense: number}, visible = true): HTMLElement {
  const el = document.createElement('span');
  el.className = `${PREFIX} ${PREFIX}--${ladder}`;
  const tier = () => renderedDescTier(el, PREFIX);
  Object.defineProperty(el, 'clientHeight', {get: () => visible ? Math.min(lines[tier()], CLAMP[tier()]) * LH : 0});
  Object.defineProperty(el, 'scrollHeight', {get: () => visible ? lines[tier()] * LH : 0});
  return el;
}

function rootOf(...els: Array<HTMLElement>): HTMLElement {
  const root = document.createElement('div');
  els.forEach((el) => root.appendChild(el));
  return root;
}

const fit = (root: HTMLElement, regrow = false) => fitDescTiers(root, {selector: `.${PREFIX}`, classPrefix: PREFIX, regrow});

describe('descTier — the ladder starts, the column decides (PL-123)', () => {
  it('the ladder is unchanged — the starting tier by length and longest word', () => {
    expect(actionDescTier('Метки Земли дешевле на 3 M€')).eq('brief');
    expect(actionDescTier('Эффект партии за 1 делегата, не за 2')).eq('regular');
    expect(actionDescTier('Повысьте производство энергии')).eq('regular');
  });

  it('steps down one tier at a time, and dense is the floor', () => {
    expect(nextDescTier('brief')).eq('regular');
    expect(nextDescTier('regular')).eq('dense');
    expect(nextDescTier('dense')).eq('dense');
  });

  it('a caption its face holds keeps it — no attribute, the bigger face stays', () => {
    const el = caption('brief', {brief: 2, regular: 2, dense: 2});
    fit(rootOf(el));
    expect(el.hasAttribute(DESC_FIT_ATTR)).eq(false);
    expect(renderedDescTier(el, PREFIX)).eq('brief');
  });

  it('«Метки Земли дешевле на 3 M€» in the 4K explorer column: three lines at the brief face → one step to regular, whole', () => {
    const el = caption('brief', {brief: 3, regular: 2, dense: 2});
    fit(rootOf(el));
    expect(el.getAttribute(DESC_FIT_ATTR)).eq('regular');
    expect(el.scrollHeight).eq(el.clientHeight);
  });

  it('two steps when the middle face does not hold it either', () => {
    const el = caption('brief', {brief: 3, regular: 3, dense: 3});
    fit(rootOf(el));
    expect(el.getAttribute(DESC_FIT_ATTR)).eq('dense');
  });

  it('dense is the overflow tier — its clamp stands, nothing below it', () => {
    const el = caption('dense', {brief: 9, regular: 7, dense: 5});
    fit(rootOf(el));
    expect(el.hasAttribute(DESC_FIT_ATTR)).eq(false);
  });

  it('a box with no layout is not judged (a display: none layer)', () => {
    const el = caption('brief', {brief: 3, regular: 2, dense: 2}, false);
    fit(rootOf(el));
    expect(el.hasAttribute(DESC_FIT_ATTR)).eq(false);
  });

  it('the grid is fitted as a whole: each caption to its own need', () => {
    const fits = caption('brief', {brief: 2, regular: 2, dense: 2});
    const oneStep = caption('regular', {brief: 4, regular: 3, dense: 3});
    const twoSteps = caption('brief', {brief: 3, regular: 3, dense: 3});
    fit(rootOf(fits, oneStep, twoSteps));
    expect([fits, oneStep, twoSteps].map((el) => renderedDescTier(el, PREFIX))).deep.eq(['brief', 'dense', 'dense']);
  });

  it('a standing step stays without `regrow` (the steady state is one read); `regrow` lets a wider column grow it back', () => {
    const lines = {brief: 3, regular: 2, dense: 2};
    const el = caption('brief', lines);
    const root = rootOf(el);
    fit(root);
    expect(el.getAttribute(DESC_FIT_ATTR)).eq('regular');
    lines.brief = 2; // the column widened: the brief face holds it now
    fit(root);
    expect(el.getAttribute(DESC_FIT_ATTR), 'no regrow — the step stands').eq('regular');
    fit(root, true);
    expect(el.hasAttribute(DESC_FIT_ATTR), 'regrow — back to the bigger face').eq(false);
  });
});
