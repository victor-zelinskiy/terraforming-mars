import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

const LESS = path.join(__dirname, '..', '..', 'src', 'styles', 'console.less');
const DOCK = path.join(__dirname, '..', '..', 'src', 'client', 'components', 'console', 'ConsoleHandDock.vue');

/**
 * THE HAND-DOCK ANCHOR CONTRACT — the pack's geometry is CSS-ONLY.
 *
 * Every back in the dock shares ONE box (`position: absolute; left: 0;
 * bottom: 0`); its entire on-screen placement is its own `transform`
 * (`--hd-dx/--hd-dy/--hd-tilt` × the pose knobs), and a re-spread is animated
 * by the card's own `transition: transform`. Nothing may ever MEASURE a dock
 * card and write a position back onto it — a measured position is a snapshot
 * of one layout, and the shell legitimately passes through transient layouts
 * inside a Vue flush (a teleported `--embed` surface standing in the root's
 * flex column for one patch shortened `.con-main` and lifted the whole footer
 * ~493px).
 *
 * Both halves of the fix are invisible to a runtime unit test and both are one
 * edit away from being undone, so they are pinned at the source:
 *
 *  1. the pack's `<transition-group>` names a NEUTRAL move class, so Vue's
 *     FLIP probe (`hasCSSTransform`) answers false and `onUpdated` returns
 *     before it measures a single rect;
 *  2. that class actually kills the transition — and does it with TWO classes,
 *     because `.con-handdock__card` declares `transition: transform` at the
 *     same specificity and would otherwise win on source order.
 *
 * Without (1) the pack inherited a ~493px FLIP delta and slid back into the
 * dock from the centre of the screen over 340ms; without (2) the same happens
 * again with no visible tell in the markup.
 */
describe('hand-dock anchor contract (pack geometry is CSS-only)', () => {
  const less = fs.readFileSync(LESS, 'utf8');
  const dock = fs.readFileSync(DOCK, 'utf8');

  it('the pack transition-group disables Vue FLIP with a named move class', () => {
    const group = /<transition-group\b[^>]*>/.exec(dock);
    expect(group, 'the pack still renders a <transition-group>').to.not.be.null;
    expect(group![0], 'the pack must name its own move class — the default `con-hd-move` runs FLIP')
      .to.match(/move-class="con-hd-still"/);
  });

  it('`.con-hd-still` neutralises the transition at a specificity the card cannot beat', () => {
    const rule = /\.con-handdock__pack\s+\.con-hd-still\s*\{([^}]*)\}/.exec(less);
    expect(rule, '.con-handdock__pack .con-hd-still must exist (two classes — see the header)').to.not.be.null;
    expect(rule![1].replace(/\s+/g, ' '), 'the move class must transition nothing')
      .to.match(/transition:\s*none/);
  });

  it('the dock chassis stays welded to the footer (no positioning of its own)', () => {
    // The pack is absolutely positioned INSIDE the dock, and the dock inside
    // the footer: the only way its cards can leave the tray is a transform.
    const pack = /&__pack\s*\{([\s\S]*?)\n {4}\}/.exec(less);
    expect(pack, '.con-handdock__pack rule').to.not.be.null;
    expect(pack![1]).to.match(/position:\s*absolute/);
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
