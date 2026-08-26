import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

const LESS = path.join(__dirname, '..', '..', 'src', 'styles', 'console.less');
const DEAL_LESS = path.join(__dirname, '..', '..', 'src', 'styles', 'console_card_deal.less');
const DOCK = path.join(__dirname, '..', '..', 'src', 'client', 'components', 'console', 'ConsoleHandDock.vue');

/**
 * THE HAND-DOCK ANCHOR CONTRACT — single-owner bodies edition.
 *
 * The dock renders CHASSIS ONLY (plate, wings, counter, pager, the pack
 * ANCHOR box); the hand's physical cards are BODIES on the reveal layer
 * (`ConsoleHandRevealLayer` / handBodies.ts), positioned exclusively by GSAP
 * transforms in the top-left-origin BodyPose grammar. Every invariant below
 * is one careless edit away from being undone, invisible to a runtime unit
 * test, and was a shipped bug at least once — so they are pinned at the
 * source:
 *
 *  1. the dock template hosts NO card elements — a card element re-added to
 *     the pack re-creates the two-owner architecture (and its «карта исчезла
 *     при свапе» class) by construction;
 *  2. `.con-handdock__pack` stays an absolutely-positioned ANCHOR (the
 *     analytic pose measures its axis; in-flow it would re-anchor the whole
 *     fan to wherever the footer flex puts it);
 *  3. `.con-handbody` pins `transform-origin: 0 0` — the analytic pose,
 *     every flight target and the packet seats compute x/y for a TOP-LEFT
 *     origin; the browser default (50% 50%) shifts the visual box by
 *     (1−s)/2·(w,h) ≈ 180px at pack scale, which rendered the whole docked
 *     fan below the viewport;
 *  4. `.con-handbody` boots `visibility: hidden` — an unseated body must
 *     never paint a natural-size card at the layer origin (gsap's first
 *     pose write flips it visible via autoAlpha);
 *  5. an embedded surface can never join the root column (unchanged from
 *     the pre-rework contract — the teleport-fallback flush protection).
 */
describe('hand-dock anchor contract (chassis-only dock, top-left bodies)', () => {
  const less = fs.readFileSync(LESS, 'utf8');
  const dealLess = fs.readFileSync(DEAL_LESS, 'utf8');
  const dock = fs.readFileSync(DOCK, 'utf8');

  it('the dock renders no card elements — bodies live on the reveal layer', () => {
    const template = /<template>([\s\S]*)<\/template>/.exec(dock);
    expect(template, 'ConsoleHandDock.vue has a template').to.not.be.null;
    expect(template![1], 'no per-card berth markup in the dock (single-owner: the layer owns every card)')
      .to.not.match(/data-hand-dock-card|__card\b|transition-group/);
    expect(template![1], 'the pack anchor box stays (the analytic pose measures its axis)')
      .to.match(/class="con-handdock__pack"/);
  });

  it('the pack anchor is absolutely positioned inside the dock', () => {
    const pack = /&__pack\s*\{([\s\S]*?)\n {4}\}/.exec(less);
    expect(pack, '.con-handdock__pack rule').to.not.be.null;
    expect(pack![1]).to.match(/position:\s*absolute/);
  });

  it('bodies pin the top-left transform origin (the BodyPose grammar)', () => {
    const body = /\.con-handbody\s*\{([^}]*)\}/.exec(dealLess);
    expect(body, '.con-handbody rule in console_card_deal.less').to.not.be.null;
    expect(body![1].replace(/\s+/g, ' '), 'transform-origin: 0 0 — the analytic pose and every flight target assume it')
      .to.match(/transform-origin:\s*0\s+0/);
  });

  it('an unseated body never paints (visibility boots hidden)', () => {
    const body = /\.con-handbody\s*\{([^}]*)\}/.exec(dealLess);
    expect(body![1].replace(/\s+/g, ' ')).to.match(/visibility:\s*hidden/);
  });

  it('an embedded surface can never join the root column', () => {
    // `.con-root` is a flex column whose `.con-main` is `flex: 1 1 0%`: one
    // stray in-flow sibling shortens the stage AND moves the footer the hand
    // dock is welded into. An `--embed*` surface wears in-zone geometry
    // (`position: relative; flex: 1`) and stands at its teleport's fallback —
    // a direct child of the root — for the flush between a host unmounting and
    // the teleport being re-homed.
    const rule = /\.con-root\s*>\s*\[class\*="--embed"\]\s*\{([^}]*)\}/.exec(less);
    expect(rule, '.con-root > [class*="--embed"] must exist').to.not.be.null;
    expect(rule![1].replace(/\s+/g, ' ')).to.match(/position:\s*absolute/);
  });
});
