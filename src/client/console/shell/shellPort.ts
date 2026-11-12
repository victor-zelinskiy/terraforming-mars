/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SHELL PORT — how the controllers of the game screen reach each other (architecture v2 — the shell slices;
 * docs/claude/console/architecture-v2/PLAN.md §5 · S-last).
 *
 * A controller is plain Composition-API code: it owns its state and names — in a typed PORT — every member of the rest
 * of the shell it reads, calls or writes. What serves that port is ONE object, late-bound: the members every controller
 * returned (each `Ref` read and written through, exactly as a template reads setup state), the component's props, and
 * `$nextTick`. It is built BEFORE the controllers (each takes it as its port) and BOUND after the last one returned.
 *
 * It is NOT the component instance. Until S-last it was — `getCurrentInstance().proxy` — which made every controller a
 * line that could only run inside a virtual-DOM component with Options members on it; a `<script setup>` / Vapor
 * component has no such proxy (`getCurrentInstance()` is `null` there). Nothing here asks for an instance: the same
 * composition runs under a virtual-DOM shell, a Vapor one, and a bare `effectScope()` in a spec.
 *
 * Two laws it enforces instead of leaving them to a review:
 *  · a controller is built before the shell exists — reading the port AT CONSTRUCTION is an error, said by name (it
 *    used to answer `undefined` silently: setup state is not on the instance until `setup()` returns);
 *  · a port row marked WRITTEN is a `Ref` of some controller — a write to anything else (a function, a mirror of module
 *    state, a prop) is refused: it could never have been reactive.
 *
 * The port is a BRIDGE, not the destination: a row of it disappears when the member it names moves into a controller
 * the caller can depend on directly, and a port's size is the measure of how entangled a domain still is.
 */
import {isRef, nextTick, ShallowUnwrapRef} from 'vue';

/** What the port serves beside the members and the props — the one piece of the instance a controller ever used. */
export type ShellInstance = {
  /** The next tick of the scheduler (Vue's `nextTick` — a `$nextTick` of no instance). */
  $nextTick(fn?: () => void): Promise<void>,
};

/** The shell as its controllers see it: every returned member (refs read through), the props, `$nextTick`. */
export type ShellOf<M, P> = ShallowUnwrapRef<M> & Readonly<P> & ShellInstance;

export type ShellPortSource<P> = {
  /** The port, typed as the caller's own. Hand it to a controller; never read it before `bind`. */
  as<Port>(): Port,
  /** The members every controller returned (and the shell's own refs / mirrors) — called ONCE, after the last one. */
  bind<M extends object>(members: M): ShellOf<M, P>,
};

type Bag = Record<string | symbol, unknown>;

export function createShellPort<P extends object>(props: P): ShellPortSource<P> {
  let members: Bag | undefined;
  const instance: ShellInstance = {$nextTick: (fn) => (fn === undefined ? nextTick() : nextTick(fn))};
  const port = new Proxy({} as Bag, {
    get(_target, key) {
      if (members === undefined) {
        // (A symbol / a `__v_*` probe is a reader asking WHAT this is — Vue's `isRef`, a debugger — not a read of a member.)
        if (typeof key === 'symbol' || key.startsWith('__v_')) {
          return undefined;
        }
        throw new Error(`shell.${key} was read while the shell is being composed — a controller reads its port inside a computed, a function or a hook, never at construction`);
      }
      // Setup state first, then props — the order the component's own proxy answered in.
      const held = members[key];
      if (held !== undefined || key in members) {
        return isRef(held) ? held.value : held;
      }
      if (key in props) {
        return (props as Bag)[key];
      }
      return (instance as Bag)[key];
    },
    set(_target, key, value) {
      const held = members?.[key];
      if (isRef(held)) {
        held.value = value;
        return true;
      }
      throw new Error(`shell.${String(key)} is not a ref of any controller — a WRITTEN row of a port names a ref`);
    },
    has(_target, key) {
      return (members !== undefined && key in members) || key in props || key in instance;
    },
  });
  return {
    as<Port>(): Port {
      return port as unknown as Port;
    },
    bind<M extends object>(bound: M): ShellOf<M, P> {
      if (members !== undefined) {
        throw new Error('the shell port is bound once — a second composition is a second port');
      }
      members = bound as unknown as Bag;
      return port as unknown as ShellOf<M, P>;
    },
  };
}
