/**
 * @console-shared LIVE — console native stands on this file.
 *
 * INPUT ABSORB — the console's DELIBERATE swallows, said out loud.
 *
 * The console absorbs a press on purpose in many places, each for a good reason: the decision's settle window
 * (`promptSequence.ts` — never answered by rhythm), a commit row's arrival (`commitArrival.ts`), the scene curtain, a
 * batch still landing on a stage (the task host's / the reveal's `arrivalPending`), a take in flight (`takingIdx`,
 * `stagingTake`), the start's press refusal, a take beat of «Добор карт» (`sending`). From the outside every one of
 * them looked exactly like a press that never arrived — the input echo said «consumed» — so every e2e driver that met
 * one grew a private act → verify loop of its own (≈ ten of them over five CI rounds, 2026-10-30 … 11-04), and every
 * spec that did not was a flake on the 4K software runner, where those windows are long.
 *
 * Two halves, one name per gate:
 *   · `noteInputAbsorbed(name)` — said AT THE SWALLOW, during the dispatch of the intent it swallows. The router
 *     brackets every dispatch (`beginInputDispatch` / `endInputDispatch`), so the key bridge's echo reports the press
 *     as `absorbed` with the gates that took it (`inputEcho.last.absorbedBy`) — the swallow is a FACT, never a guess.
 *   · `registerInputAbsorber(name, active, opts)` — the gate's LIVE predicate: «would you still swallow it now?».
 *     A driver whose press was absorbed waits for exactly that gate to open and presses again. A gate that is
 *     `global` (it stands in front of every surface — the settle, the commit arrival, the curtain) is also waited out
 *     BEFORE a press is sent; an instance gate (a mounted component's own) is asked only after it actually swallowed,
 *     so a parked or hidden instance can never hold a press meant for another surface.
 *
 * Dependency-free and non-reactive (the `inputEcho.ts` idiom): the router imports it, so it must not drag anything
 * behind it. Published as `window.__conInputAbsorb(code?)` by the key bridge's install (`installInputAbsorbProbe`).
 */

/** The semantic buttons a press can carry (`SemanticButton` — repeated here to stay dependency-free) plus `nav`. */
export type AbsorbButton = string;

/** What a gate swallows: the DECIDING presses (A, X, the bumpers, the triggers), every verb (+ B), or everything. */
export type AbsorbScope = 'deciding' | 'verbs' | 'all';

const DECIDING: ReadonlySet<string> = new Set(['confirm', 'secondary', 'bumperL', 'bumperR', 'triggerL', 'triggerR']);

export function absorbScopeCovers(scope: AbsorbScope, button: AbsorbButton | undefined): boolean {
  if (button === undefined || scope === 'all') {
    return true;
  }
  if (DECIDING.has(button)) {
    return true;
  }
  return scope === 'verbs' && button === 'back';
}

export type InputAbsorberOptions = {
  /** Which presses the gate swallows (default `deciding`). */
  scope?: AbsorbScope;
  /** The gate stands in front of EVERY surface — a driver waits it out before sending (default false). */
  global?: boolean;
};

type Absorber = {name: string, active: () => boolean, scope: AbsorbScope, global: boolean};

const absorbers = new Map<number, Absorber>();
let nextId = 1;

/** Declare a gate's live predicate. Returns the unregister (a component calls it in `beforeUnmount`). */
export function registerInputAbsorber(name: string, active: () => boolean, opts: InputAbsorberOptions = {}): () => void {
  const id = nextId++;
  absorbers.set(id, {name, active, scope: opts.scope ?? 'deciding', global: opts.global === true});
  return () => {
    absorbers.delete(id);
  };
}

function isActive(a: Absorber): boolean {
  try {
    return a.active();
  } catch {
    return false;
  }
}

/** The gates swallowing `button` right now (`globalOnly` — only those standing in front of every surface). */
export function activeInputAbsorbers(button?: AbsorbButton, globalOnly = false): Array<string> {
  const names = new Set<string>();
  for (const a of absorbers.values()) {
    if ((!globalOnly || a.global) && absorbScopeCovers(a.scope, button) && isActive(a)) {
      names.add(a.name);
    }
  }
  return [...names];
}

/** Is any gate of these NAMES still swallowing `button`? (An unregistered name — its surface gone — is open.) */
export function absorbersStillActive(names: ReadonlyArray<string>, button?: AbsorbButton): Array<string> {
  const want = new Set(names);
  const out = new Set<string>();
  for (const a of absorbers.values()) {
    if (want.has(a.name) && absorbScopeCovers(a.scope, button) && isActive(a)) {
      out.add(a.name);
    }
  }
  return [...out];
}

export type AbsorbRecord = {name: string, at: number};

const RECENT_MAX = 24;
const recent: Array<AbsorbRecord> = [];
let absorbedCount = 0;
let dispatchDepth = 0;
let noted: Array<string> = [];
let lastDispatchNoted: Array<string> = [];

/** The router opens a dispatch (nested dispatches share the outermost bracket). */
export function beginInputDispatch(): void {
  if (dispatchDepth === 0) {
    noted = [];
  }
  dispatchDepth++;
}

/** …and closes it: the gates that swallowed THIS intent (empty — nobody did). */
export function endInputDispatch(): ReadonlyArray<string> {
  dispatchDepth = Math.max(0, dispatchDepth - 1);
  if (dispatchDepth === 0) {
    lastDispatchNoted = noted;
    noted = [];
  }
  return lastDispatchNoted;
}

/** The gates that swallowed the LAST closed dispatch — the key bridge's echo reads it. */
export function lastDispatchAbsorbedBy(): ReadonlyArray<string> {
  return lastDispatchNoted;
}

/** Said AT the swallow: `name` took this intent on purpose. */
export function noteInputAbsorbed(name: string): void {
  absorbedCount++;
  recent.push({name, at: Date.now()});
  if (recent.length > RECENT_MAX) {
    recent.shift();
  }
  if (dispatchDepth > 0 && !noted.includes(name)) {
    noted.push(name);
  }
}

export type InputAbsorbSnapshot = {
  /** Every gate swallowing the asked button right now (global and instance). */
  active: Array<string>;
  /** …of those, the ones standing in front of every surface. */
  activeGlobal: Array<string>;
  /** Every registered gate name (the witness that the wiring is present). */
  registered: Array<string>;
  absorbed: number;
  recent: Array<AbsorbRecord>;
};

export function inputAbsorbSnapshot(button?: AbsorbButton): InputAbsorbSnapshot {
  return {
    active: activeInputAbsorbers(button),
    activeGlobal: activeInputAbsorbers(button, true),
    registered: [...new Set([...absorbers.values()].map((a) => a.name))],
    absorbed: absorbedCount,
    recent: recent.slice(),
  };
}

/**
 * The probe: `__conInputAbsorb(code?)` — the key code is mapped to its button by the key bridge's own map (`mapCode`),
 * `__conInputAbsorb(code, names)` asks whether the named gates are still closed for it.
 */
export function installInputAbsorbProbe(mapCode: (code: string) => AbsorbButton | undefined): void {
  if (typeof window === 'undefined') {
    return;
  }
  (window as unknown as {__conInputAbsorb?: unknown}).__conInputAbsorb = (code?: string, names?: ReadonlyArray<string>) => {
    const button = code === undefined ? undefined : mapCode(code);
    return names === undefined ? inputAbsorbSnapshot(button) : {...inputAbsorbSnapshot(button), still: absorbersStillActive(names, button)};
  };
}

export function resetInputAbsorbForTest(): void {
  absorbers.clear();
  recent.length = 0;
  absorbedCount = 0;
  dispatchDepth = 0;
  noted = [];
  lastDispatchNoted = [];
}
