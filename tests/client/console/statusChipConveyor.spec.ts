/*
 * THE TOP-BAR CHIP CONVEYOR (src/client/console/statusChipConveyor.ts) —
 * the generation-order reorder glide of the status strip's player chips.
 *
 * Pinned here:
 *  1. rotationShift — the pure ring math: only a true rotation animates
 *     (same set, same length, shifted), anything else snaps.
 *  2. Lifecycle honesty — mount/sync never animates; re-delivery of the
 *     same order triggers nothing; a non-rotation change snaps cleanly.
 *  3. The run itself (faked WAAPI + rects): ONE transform animation on
 *     the RIBBON drives the whole belt (per-element animations start on
 *     the compositor at different times and tear the ribbon — the bug
 *     class this architecture removes); survivors get residual
 *     corrections only when their own FLIP delta differs from the belt;
 *     the exit ghost is a frozen decorative clone parented INTO the
 *     ribbon, its only own animation the opacity ramp, started at the
 *     belt's `ready`. The finish leaves NOTHING (no ghosts, no mask
 *     class, no transforms).
 *  4. Retarget — a second reorder mid-flight cancels the first run's
 *     artifacts before the new one starts.
 */
import {expect} from 'chai';
import {createChipConveyor, rotationShift, CONVEYOR_MS} from '@/client/console/statusChipConveyor';

const CONVEYOR_CLASS = 'con-status__players--conveyor';
const GHOST_SELECTOR = '.con-status__pghost';

describe('statusChipConveyor', () => {
  describe('rotationShift', () => {
    it('detects the generation handoff (left-rotation by 1)', () => {
      expect(rotationShift(['a', 'b'], ['b', 'a'])).to.eq(1);
      expect(rotationShift(['a', 'b', 'c', 'd'], ['b', 'c', 'd', 'a'])).to.eq(1);
    });
    it('detects deeper rotations (coalesced updates, undo)', () => {
      expect(rotationShift(['a', 'b', 'c', 'd'], ['c', 'd', 'a', 'b'])).to.eq(2);
      expect(rotationShift(['b', 'c', 'd', 'a'], ['a', 'b', 'c', 'd'])).to.eq(3);
    });
    it('refuses everything that is not a rotation', () => {
      expect(rotationShift(['a', 'b'], ['a', 'b'])).to.eq(undefined);
      expect(rotationShift(['a'], ['a'])).to.eq(undefined);
      expect(rotationShift(['a', 'b'], ['a', 'c'])).to.eq(undefined);
      expect(rotationShift(['a', 'b', 'c'], ['b', 'a', 'c'])).to.eq(undefined);
      expect(rotationShift(['a', 'b'], ['b', 'a', 'c'])).to.eq(undefined);
      expect(rotationShift(['a', 'b', 'c'], ['c', 'b', 'a'])).to.eq(undefined);
    });
  });

  describe('the conveyor lifecycle', () => {
    type AnimOptions = {duration?: number, easing?: string, fill?: string, composite?: string};
    type FakeAnim = {
      el: Element,
      keyframes: Array<Record<string, unknown>>,
      options: AnimOptions,
      cancelled: boolean,
      finish: () => void,
    };

    let container: HTMLElement;
    let ribbon: HTMLElement;
    let anims: Array<FakeAnim>;
    let hadPrototypeAnimate = false;

    /** Give an element a fake layout rect (jsdom lays nothing out). */
    function rig(el: HTMLElement, rect: {left: number, top?: number, width: number, height?: number}): void {
      el.getBoundingClientRect = () => ({
        left: rect.left, top: rect.top ?? 10, width: rect.width, height: rect.height ?? 27,
        right: rect.left + rect.width, bottom: (rect.top ?? 10) + (rect.height ?? 27),
        x: rect.left, y: rect.top ?? 10, toJSON: () => ({}),
      } as DOMRect);
    }

    /** Fake WAAPI at the PROTOTYPE — the module animates clones it creates
     *  itself, so an instance patch would miss the exit ghosts. */
    function installFakeAnimate(): void {
      const proto = Element.prototype as unknown as {animate?: unknown};
      hadPrototypeAnimate = typeof proto.animate === 'function';
      proto.animate = function(this: Element, keyframes: Array<Record<string, unknown>>, options: AnimOptions) {
        let resolve: () => void = () => {};
        const finished = new Promise<void>((r) => {
          resolve = r;
        });
        const anim: FakeAnim = {el: this, keyframes, options, cancelled: false, finish: resolve};
        anims.push(anim);
        return {
          finished,
          cancel: () => {
            anim.cancelled = true;
            resolve();
          },
        };
      };
    }

    function uninstallFakeAnimate(): void {
      const proto = Element.prototype as unknown as {animate?: unknown};
      if (!hadPrototypeAnimate) {
        delete proto.animate;
      }
    }

    function chip(color: string, rect: {left: number, width: number}): HTMLElement {
      const el = document.createElement('span');
      el.className = 'con-status__player';
      el.dataset.color = color;
      el.textContent = color;
      rig(el, rect);
      ribbon.appendChild(el);
      return el;
    }

    function chipEl(color: string): HTMLElement {
      const el = container.querySelector<HTMLElement>(`[data-color="${color}"]`);
      expect(el, `chip ${color} must be in the DOM`).to.not.eq(null);
      return el!;
    }

    /** Simulate the Vue patch: move the chips into the new order + rects. */
    function patchOrder(order: Array<string>, rects: Array<{left: number, width: number}>): void {
      order.forEach((color, i) => {
        const el = chipEl(color);
        rig(el, rects[i]);
        ribbon.appendChild(el);
      });
    }

    function tick(times = 4): Promise<void> {
      let p = Promise.resolve();
      for (let i = 0; i < times; i++) {
        p = p.then(() => undefined);
      }
      return p;
    }

    async function settleRuns(): Promise<void> {
      // The ghost fade is created a microtask after the belt (the ready
      // chain), so finish in ROUNDS until everything created has settled.
      for (let round = 0; round < 3; round++) {
        for (const a of anims) {
          a.finish();
        }
        await tick();
      }
    }

    beforeEach(() => {
      anims = [];
      installFakeAnimate();
      container = document.createElement('div');
      container.className = 'con-status__players';
      rig(container, {left: 100, top: 5, width: 300, height: 40});
      ribbon = document.createElement('div');
      ribbon.className = 'con-status__ribbon';
      rig(ribbon, {left: 100, top: 5, width: 300, height: 40});
      container.appendChild(ribbon);
      document.body.appendChild(container);
    });

    afterEach(() => {
      uninstallFakeAnimate();
      container.remove();
    });

    it('sync + a content-only update animates nothing', () => {
      const conveyor = createChipConveyor();
      chip('red', {left: 100, width: 150});
      chip('green', {left: 260, width: 120});
      conveyor.sync(['red', 'green']);
      conveyor.beforePatch(container, ['red', 'green']);
      conveyor.afterPatch(container, ['red', 'green']);
      expect(anims.length).to.eq(0);
      expect(container.classList.contains(CONVEYOR_CLASS)).to.eq(false);
      conveyor.dispose();
    });

    it('a non-rotation change (player set changed) snaps with no artifacts', () => {
      const conveyor = createChipConveyor();
      chip('red', {left: 100, width: 150});
      chip('green', {left: 260, width: 120});
      conveyor.sync(['red', 'green']);
      conveyor.beforePatch(container, ['red', 'blue']);
      conveyor.afterPatch(container, ['red', 'blue']);
      expect(anims.length).to.eq(0);
      expect(container.querySelectorAll(GHOST_SELECTOR).length).to.eq(0);
      expect(container.classList.contains(CONVEYOR_CLASS)).to.eq(false);
      conveyor.dispose();
    });

    it('the generation handoff runs the belt: ONE ribbon transform, no per-chip animations, a frozen exit ghost riding the ribbon', async () => {
      const conveyor = createChipConveyor();
      chip('red', {left: 100, width: 150});
      chip('green', {left: 260, width: 120});
      conveyor.sync(['red', 'green']);

      conveyor.beforePatch(container, ['green', 'red']);
      // The Vue patch: green leads at the old left edge, red takes the tail.
      patchOrder(['green', 'red'], [{left: 100, width: 120}, {left: 230, width: 150}]);
      conveyor.afterPatch(container, ['green', 'red']);

      expect(container.classList.contains(CONVEYOR_CLASS), 'the ring mask is up for the run').to.eq(true);
      // ONE driver: the ribbon glides from the old pose (survivor green
      // moved 260→100, so the belt starts +160 right of natural) to rest.
      const transforms = anims.filter((a) => 'transform' in (a.keyframes[0] ?? {}));
      expect(transforms.length, 'exactly one transform animation — the ribbon').to.eq(1);
      expect(transforms[0].el).to.eq(ribbon);
      expect(transforms[0].keyframes[0].transform).to.eq('translate(160px, 0px)');
      expect(transforms[0].keyframes[transforms[0].keyframes.length - 1].transform).to.eq('translate(0px, 0px)');
      expect(transforms[0].options.fill).to.eq('none');
      expect(transforms[0].options.duration).to.eq(CONVEYOR_MS);

      // The exit ghost: red's OLD frame, parented INTO the ribbon at its
      // old spot minus the belt's start pose (100 − 100 − 160 = −160), so
      // the one ribbon transform carries it out. Decorative: aria-hidden,
      // no data-color identity, fixed old-frame box.
      const ghost = container.querySelector<HTMLElement>(GHOST_SELECTOR);
      expect(ghost).to.not.eq(null);
      expect(ghost!.parentElement, 'the ghost rides the ribbon').to.eq(ribbon);
      expect(ghost!.getAttribute('aria-hidden')).to.eq('true');
      expect(ghost!.hasAttribute('data-color')).to.eq(false);
      expect(ghost!.style.left).to.eq('-160px');
      expect(ghost!.style.width).to.eq('150px');

      // Its fade starts at the belt's ready (a microtask here) and is the
      // ghost's ONLY own animation — opacity keyframes, no transform.
      await tick();
      const fades = anims.filter((a) => 'opacity' in (a.keyframes[0] ?? {}));
      expect(fades.length, 'exactly one fade — the ghost').to.eq(1);
      expect(fades[0].el).to.eq(ghost);
      expect(fades[0].keyframes.some((k) => 'transform' in k), 'no transform of its own — the ribbon carries it').to.eq(false);
      expect(fades[0].keyframes[fades[0].keyframes.length - 1].opacity).to.eq(0);
      expect(fades[0].options.fill).to.eq('forwards');

      // The finish leaves NOTHING: no ghost, no mask class.
      await settleRuns();
      expect(container.querySelectorAll(GHOST_SELECTOR).length).to.eq(0);
      expect(container.classList.contains(CONVEYOR_CLASS)).to.eq(false);
      conveyor.dispose();
    });

    it('a simultaneous width change earns a survivor its residual correction', async () => {
      // 3-chip ring [red, green, blue] → [green, blue, red]: the belt is
      // the FIRST survivor's delta (green), and blue — whose neighbour's
      // width changed in the same patch — lands off that vector, so it
      // gets the one residual correction on top of the ribbon.
      chip('red', {left: 100, width: 150});
      chip('green', {left: 260, width: 120});
      chip('blue', {left: 390, width: 100});
      const conveyor2 = createChipConveyor();
      conveyor2.sync(['red', 'green', 'blue']);
      conveyor2.beforePatch(container, ['green', 'blue', 'red']);
      // green: 260→100 (belt = 160); blue: 390→210 (own delta 180 ≠ 160).
      patchOrder(['green', 'blue', 'red'],
        [{left: 100, width: 100}, {left: 210, width: 100}, {left: 320, width: 150}]);
      conveyor2.afterPatch(container, ['green', 'blue', 'red']);

      // The ribbon + blue's own residual + the ENTERER (red) inheriting
      // blue's residual — its neighbour in the new order — so the gap
      // between them stays the exact new-layout gap all flight.
      const transforms = anims.filter((a) => 'transform' in (a.keyframes[0] ?? {}));
      expect(transforms.length, 'the ribbon + one residual + the inherited one').to.eq(3);
      expect(transforms[0].el).to.eq(ribbon);
      const byColor = new Map(transforms.slice(1).map((a) => [(a.el as HTMLElement).dataset.color, a]));
      expect([...byColor.keys()].sort()).to.deep.eq(['blue', 'red']);
      expect(byColor.get('blue')!.keyframes[0].transform).to.eq('translate(20px, 0px)');
      expect(byColor.get('red')!.keyframes[0].transform, 'the enterer rides its neighbour\'s correction')
        .to.eq('translate(20px, 0px)');
      expect(byColor.get('blue')!.options.composite).to.eq('add');
      await settleRuns();
      conveyor2.dispose();
    });

    it('a second reorder mid-flight cancels the first run before starting over', () => {
      const conveyor = createChipConveyor();
      chip('red', {left: 100, width: 150});
      chip('green', {left: 260, width: 120});
      conveyor.sync(['red', 'green']);

      conveyor.beforePatch(container, ['green', 'red']);
      patchOrder(['green', 'red'], [{left: 100, width: 120}, {left: 230, width: 150}]);
      conveyor.afterPatch(container, ['green', 'red']);
      const firstRun = [...anims];
      expect(firstRun.length).to.be.greaterThan(0);

      conveyor.beforePatch(container, ['red', 'green']);
      expect(firstRun.every((a) => a.cancelled), 'the first run is cancelled at retarget').to.eq(true);
      expect(container.querySelectorAll(GHOST_SELECTOR).length, 'its ghosts are gone before the patch').to.eq(0);
      patchOrder(['red', 'green'], [{left: 100, width: 150}, {left: 260, width: 120}]);
      conveyor.afterPatch(container, ['red', 'green']);
      expect(anims.length).to.be.greaterThan(firstRun.length);
      expect(container.classList.contains(CONVEYOR_CLASS)).to.eq(true);
      conveyor.dispose();
      expect(container.querySelectorAll(GHOST_SELECTOR).length).to.eq(0);
      expect(container.classList.contains(CONVEYOR_CLASS)).to.eq(false);
    });

    it('dispose mid-flight removes every artifact', () => {
      const conveyor = createChipConveyor();
      chip('red', {left: 100, width: 150});
      chip('green', {left: 260, width: 120});
      conveyor.sync(['red', 'green']);
      conveyor.beforePatch(container, ['green', 'red']);
      patchOrder(['green', 'red'], [{left: 100, width: 120}, {left: 230, width: 150}]);
      conveyor.afterPatch(container, ['green', 'red']);
      expect(container.classList.contains(CONVEYOR_CLASS)).to.eq(true);
      conveyor.dispose();
      expect(container.querySelectorAll(GHOST_SELECTOR).length).to.eq(0);
      expect(container.classList.contains(CONVEYOR_CLASS)).to.eq(false);
    });
  });
});
