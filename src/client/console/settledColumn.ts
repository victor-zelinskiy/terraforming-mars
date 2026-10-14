import {gsap} from 'gsap';
import {nextTick} from 'vue';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';

/*
 * THE SETTLED COLUMN — a decision column that composes CENTRED when it opens and never re-centres while the player
 * decides in it.
 *
 * The owner's 4K report of 2026-10-14: «after choosing an option the workspace jumps — the components twitch». Both
 * composers' decision columns (`__actright`, `__playright`) centre their content block (`justify-content: safe
 * center` — the owner's M3 composition: the formula level with the card's printed rows), so EVERY change of the
 * block's height re-centred it: the action composer's formula grew by its «Вы получите» side and the tiles slid 126 px
 * down under the cursor that had just pressed them; the play composer gained its «Выбор перед розыгрышем» section and
 * everything above it slid 122 px up while the commit rail slid down.
 *
 * The law: the column centres for its OPENING composition; the player's FIRST press pins the block's top where it
 * stands (`pin`) — from then on the block grows DOWNWARD into the room under it, and moves up only as far as it must
 * to stay inside the column (`settleTop` — the clamp, never a re-centre). Whatever the press did inside the block is
 * not a cut either: the groups that moved slide from where they were to where they are (`around` the press: `capture`
 * before the press is handled, `play` after Vue's flush — FLIP, transform only), a group that is new rises in.
 * ⚠ The host's own `beforeUpdate` / `updated` are NOT the moment: a column's content lives in a scroller's SLOT, and a
 * change inside a slot re-renders the CHILD alone — the host's hooks never fire (measured: the play composer's commit
 * rail jumped 243 px with no slide). A host whose step owns the whole
 * column (the played-target step) `suspend`s the pin for that step and gets it back on return; a frame that changes
 * size (a profile switch, the window) `release`s it — that is a new composition, centred again.
 *
 * No rule lives here, and nothing reads game state: this is geometry of a column the host hands in.
 */

/** Where the pinned block stands: never lower than it was pinned, never so low that its NATURAL height overflows. */
export function settleTop(current: number, available: number, natural: number): number {
  const maxTop = Math.max(0, available - natural);
  return Math.max(0, Math.min(current, maxTop));
}

/** One measured group: its top (px, page) — `parent` is the index of the nearest measured ancestor, or -1. */
export type SettleRect = {top: number, parent: number};

/**
 * The FLIP offsets, each group RELATIVE to its nearest measured ancestor (a group inside a group that moved by the
 * same amount does not move again — transforms compose down the tree). `undefined` for a group that is new.
 */
export function relativeDeltas(before: ReadonlyArray<SettleRect | undefined>, after: ReadonlyArray<SettleRect>): Array<number | undefined> {
  const abs = after.map((a, i) => (before[i] === undefined ? undefined : (before[i] as SettleRect).top - a.top));
  return after.map((a, i) => {
    const own = abs[i];
    if (own === undefined) {
      return undefined;
    }
    const parentShift = a.parent >= 0 ? (abs[a.parent] ?? 0) : 0;
    return own - parentShift;
  });
}

/** The groups of a block that settle together: its work-surface groups, decision rows and choice groups. */
const SETTLE_ITEMS = '[data-unfold-item], [data-settle-item], .con-composer__row, .con-vchoice';
/** Below this a move is layout noise (sub-pixel rounding, a hairline), never a jump the eye reads. */
const SETTLE_MIN_PX = 2;
const SETTLE_MS = 240;
const ARRIVE_MS = 220;

export type SettledColumnHost = {
  /** The stretched column whose content is centred (`justify-content: safe center`). */
  column: () => HTMLElement | null | undefined;
  /** Its in-flow content block (the plate / the work scroll). */
  block: () => HTMLElement | null | undefined;
  /** May the column settle now? (the configuration state — not a reveal, a hosted step, an in-flight commit). */
  active: () => boolean;
};

export class SettledColumn {
  private pinned: number | undefined = undefined;
  private suspended = false;
  private styled: HTMLElement | undefined = undefined;
  private frame: {w: number, h: number} | undefined = undefined;
  private snapshot: {block: HTMLElement, height: number, rects: Map<HTMLElement, number>} | undefined = undefined;
  private scheduled = false;
  /** The groups THIS column is sliding (any other running tween on a group belongs to someone else — the opening
   *  cascade, a commit beat — and the group is left alone). */
  private readonly sliding = new WeakSet<Element>();

  constructor(private readonly host: SettledColumnHost) {}

  /** The player's press: freeze the block's top where it stands (centred). Idempotent. */
  public pin(): void {
    if (this.pinned !== undefined || this.suspended || !this.host.active()) {
      return;
    }
    const column = this.host.column();
    const block = this.host.block();
    if (column === null || column === undefined || block === null || block === undefined || block.parentElement !== column) {
      return;
    }
    const top = block.getBoundingClientRect().top - column.getBoundingClientRect().top - column.clientTop - padTop(column);
    this.pinned = Math.max(0, Math.round(top));
    this.frame = {w: column.clientWidth, h: column.clientHeight};
    this.apply(column, this.pinned);
  }

  /**
   * THE PRESS: pin (first time), measure every group as the player sees it, and settle once the press's consequences
   * are patched — after Vue's flush, children included. Repeated calls in one tick keep the FIRST snapshot.
   */
  public around(): void {
    this.pin();
    if (this.scheduled) {
      return;
    }
    this.capture();
    if (this.snapshot === undefined) {
      return;
    }
    this.scheduled = true;
    // One microtask first: by then the press has queued its flush, so `nextTick` resolves AFTER it (a `nextTick`
    // taken before the state change resolves on the bare promise, ahead of the flush).
    void Promise.resolve().then(() => nextTick(() => {
      this.scheduled = false;
      this.play();
    }));
  }

  /** A step that owns the whole column: lift the pin while it stands (`on`), put it back after (clamped). */
  public suspend(on: boolean): void {
    if (this.suspended === on) {
      return;
    }
    this.suspended = on;
    const column = this.host.column();
    if (on) {
      this.unstyle();
      return;
    }
    if (this.pinned !== undefined && column !== null && column !== undefined) {
      this.apply(column, this.clamped(column, this.pinned));
    }
  }

  /** A new composition (the frame changed size, the column left): centre again from scratch. */
  public release(): void {
    this.pinned = undefined;
    this.frame = undefined;
    this.snapshot = undefined;
    this.unstyle();
  }

  /** Before the host's DOM patch: where every group stands now (as the player sees it, transforms included). */
  public capture(): void {
    this.snapshot = undefined;
    if (this.pinned === undefined || this.suspended || !this.host.active()) {
      return;
    }
    const block = this.host.block();
    if (block === null || block === undefined) {
      return;
    }
    const rects = new Map<HTMLElement, number>();
    for (const el of [block, ...settleItems(block)]) {
      if (this.owns(el)) {
        rects.set(el, el.getBoundingClientRect().top);
      }
    }
    this.snapshot = {block, height: block.offsetHeight, rects};
  }

  /** After the patch: clamp the pin to the block's new height, then slide every group from where it was. */
  public play(): void {
    const snap = this.snapshot;
    this.snapshot = undefined;
    const column = this.host.column();
    const block = this.host.block();
    if (this.pinned === undefined || column === null || column === undefined) {
      return;
    }
    if (block === null || block === undefined || block.parentElement !== column) {
      // The surface left (a reveal, an outcome zone): the pin was this surface's.
      this.release();
      return;
    }
    if (!this.host.active()) {
      // The commit is in flight: the pin HOLDS (the commit beat measures its anchors on this very plate — releasing here
      // re-centred the column under the flights: the rail-landing chips were born and absorbed off their icons), and
      // nothing slides.
      return;
    }
    if (this.frame !== undefined && (Math.abs(column.clientWidth - this.frame.w) > 1 || Math.abs(column.clientHeight - this.frame.h) > 1)) {
      this.release();
      return;
    }
    if (this.suspended) {
      return;
    }
    const current = this.appliedTop(column);
    const next = this.clamped(column, current);
    if (next !== current) {
      this.apply(column, next);
    }
    if (snap === undefined || snap.block !== block || consoleReducedMotionActive()) {
      return;
    }
    this.flip(block, snap);
  }

  /**
   * Unmount (`beforeUnmount`): STATE ONLY — never a write to the column's own DOM.
   *
   * Vue runs the hook SYNCHRONOUSLY when the vnode goes, and the band's leave transition keeps the surface PAINTED for
   * its whole fade afterwards (`beforeunmount-still-paints-during-leave`). Un-pinning here re-centred the column on the
   * leave's first frame: a composer whose block had shrunk under the pin (the colony ledger's receipt) jumped 134 px
   * (fhd) / 116 px (4K) at full opacity as the workspace left — `console-habitat-science` «the ledger stood in ONE
   * box». The inline pin dies with the node; a running slide is FROZEN where it stands (killed, never cleared — a
   * cleared transform snaps), and the pending press's `play` finds no pin and does nothing.
   */
  public stop(): void {
    const block = this.host.block();
    if (block !== null && block !== undefined) {
      const items = [block, ...Array.from(block.querySelectorAll<HTMLElement>(SETTLE_ITEMS))];
      gsap.killTweensOf(items.filter((el) => this.sliding.has(el)));
    }
    this.pinned = undefined;
    this.frame = undefined;
    this.snapshot = undefined;
    this.styled = undefined;
  }

  /** A group this column may measure and slide: not running someone else's tween. */
  private owns(el: Element): boolean {
    return !gsap.isTweening(el) || this.sliding.has(el);
  }

  private flip(block: HTMLElement, snap: {height: number, rects: Map<HTMLElement, number>}): void {
    const items = [block, ...settleItems(block)].filter((el) => this.owns(el));
    // Measure the LAYOUT position: kill a slide still in flight and clear its offset first (its start was read above as
    // the visual position, so the new slide picks up exactly where the old one stood).
    for (const el of items) {
      if (this.sliding.has(el)) {
        gsap.killTweensOf(el);
        gsap.set(el, {clearProps: 'opacity,transform'});
        this.sliding.delete(el);
      }
    }
    const index = new Map<HTMLElement, number>(items.map((el, i) => [el, i]));
    const after: Array<SettleRect> = items.map((el) => ({top: el.getBoundingClientRect().top, parent: parentIndex(el, block, index)}));
    const before: Array<SettleRect | undefined> = items.map((el, i) => {
      const top = snap.rects.get(el);
      return top === undefined ? undefined : {top, parent: after[i].parent};
    });
    const deltas = relativeDeltas(before, after);
    // A group is NEW only when the layout actually changed around it — a node re-created by a patch that moved nothing
    // must not blink in.
    const changed = Math.abs(block.offsetHeight - snap.height) >= SETTLE_MIN_PX ||
      deltas.some((dy) => dy !== undefined && Math.abs(dy) >= SETTLE_MIN_PX);
    if (!changed) {
      return;
    }
    items.forEach((el, i) => {
      const dy = deltas[i];
      const done = () => {
        this.sliding.delete(el);
      };
      if (dy === undefined) {
        // NEW: it rises into the place the others made for it.
        if (el !== block && !el.matches('.con-vchoice') && el.offsetHeight > 0) {
          this.sliding.add(el);
          gsap.fromTo(el, {opacity: 0, y: 10}, {opacity: 1, y: 0, duration: motionMs(ARRIVE_MS) / 1000, ease: 'power2.out', clearProps: 'opacity,transform', onComplete: done, onInterrupt: done});
        }
        return;
      }
      if (Math.abs(dy) < SETTLE_MIN_PX) {
        return;
      }
      this.sliding.add(el);
      gsap.fromTo(el, {y: dy}, {y: 0, duration: motionMs(SETTLE_MS) / 1000, ease: 'power3.out', clearProps: 'transform', onComplete: done, onInterrupt: done});
    });
  }

  private clamped(column: HTMLElement, top: number): number {
    const block = this.host.block();
    if (block === null || block === undefined) {
      return top;
    }
    const available = column.clientHeight - padBottom(column);
    return settleTop(top, available, naturalHeight(block));
  }

  private appliedTop(column: HTMLElement): number {
    const v = parseFloat(column.style.paddingTop);
    return Number.isFinite(v) ? v : (this.pinned ?? 0);
  }

  private apply(column: HTMLElement, top: number): void {
    this.styled = column;
    column.style.justifyContent = 'flex-start';
    column.style.paddingTop = `${top}px`;
    column.setAttribute('data-settled', '');
  }

  private unstyle(): void {
    const column = this.styled;
    this.styled = undefined;
    if (column === undefined) {
      return;
    }
    column.style.justifyContent = '';
    column.style.paddingTop = '';
    column.removeAttribute('data-settled');
  }
}

function padTop(el: HTMLElement): number {
  const v = parseFloat(getComputedStyle(el).paddingTop);
  return Number.isFinite(v) ? v : 0;
}

function padBottom(el: HTMLElement): number {
  const v = parseFloat(getComputedStyle(el).paddingBottom);
  return Number.isFinite(v) ? v : 0;
}

/** The block's NATURAL height: its box plus whatever its own scrollers hide. */
function naturalHeight(block: HTMLElement): number {
  let hidden = 0;
  for (const vp of Array.from(block.querySelectorAll<HTMLElement>('.con-scroll-area__viewport'))) {
    hidden += Math.max(0, vp.scrollHeight - vp.clientHeight);
  }
  return block.offsetHeight + hidden;
}

function settleItems(block: HTMLElement): Array<HTMLElement> {
  return Array.from(block.querySelectorAll<HTMLElement>(SETTLE_ITEMS)).filter((el) => {
    // An absolutely placed layer (the R3 effects layer, a hosted stage) is not part of the column's flow.
    const position = getComputedStyle(el).position;
    return position !== 'absolute' && position !== 'fixed';
  });
}

function parentIndex(el: HTMLElement, block: HTMLElement, index: Map<HTMLElement, number>): number {
  for (let p = el.parentElement; p !== null && p !== block.parentElement; p = p.parentElement) {
    const i = index.get(p);
    if (i !== undefined) {
      return i;
    }
  }
  return -1;
}
