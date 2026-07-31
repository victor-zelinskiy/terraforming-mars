/*
 * ⚠️⚠️⚠️ TEMPORARY DIAGNOSTIC — @TAKE-DIAG — DELETE ME ⚠️⚠️⚠️
 *
 * Instrumentation for ONE open question: «взять всё» (B) collects the batch and
 * flies it to the hand correctly, while taking the LAST card one-by-one does
 * not. Both paths call the same `collectTaken()` → `runHandIntake()`, so the
 * difference has to be in WHEN they run and WHAT they see — this records both.
 *
 * ── HOW TO REMOVE (precise, not by commit) ─────────────────────────────────
 *   1. delete this file;
 *   2. `grep -rn "@TAKE-DIAG" src/` and delete every line it reports
 *      (every call site is a single self-contained line ending in that token,
 *      plus the import lines).
 * Nothing else references it, and no behaviour depends on it.
 *
 * ── HOW TO READ IT OFF THE DEVICE ──────────────────────────────────────────
 * Everything is printed with the `[TAKEDIAG]` prefix AND kept in a ring buffer:
 *   · `__takeDiagDump()`  in the devtools console → the whole run as text
 *   · `__takeDiagClear()` → start a fresh capture before the second case
 * Each line is `#<seq> +<ms since the run started> <tag> <json>`, so the two
 * cases can be diffed line for line.
 */

type DiagData = Record<string, unknown>;

const BUFFER: Array<string> = [];
const MAX = 600;
let seq = 0;
let t0 = 0;

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * Record one step. Deliberately total and defensive: a diagnostic must never
 * be able to change the behaviour it is measuring, so every failure is
 * swallowed.
 */
export function takeDiag(tag: string, data?: DiagData): void {
  try {
    if (t0 === 0) {
      t0 = now();
    }
    seq++;
    const dt = Math.round(now() - t0);
    let payload = '';
    if (data !== undefined) {
      try {
        payload = JSON.stringify(data);
      } catch {
        payload = '<unserializable>';
      }
    }
    const line = `#${seq} +${dt}ms ${tag} ${payload}`;
    BUFFER.push(line);
    if (BUFFER.length > MAX) {
      BUFFER.shift();
    }
    console.log(`[TAKEDIAG] ${line}`);
  } catch {
    /* a diagnostic never throws into the flow it observes */
  }
}

/** Measure an element for the log: is it there, connected, and where. */
export function diagRect(el: Element | null | undefined): Record<string, unknown> {
  try {
    if (el === null || el === undefined) {
      return {el: 'MISSING'};
    }
    const r = el.getBoundingClientRect();
    return {
      el: 'ok',
      connected: (el as HTMLElement).isConnected,
      x: Math.round(r.left),
      y: Math.round(r.top),
      w: Math.round(r.width),
      h: Math.round(r.height),
    };
  } catch {
    return {el: 'ERR'};
  }
}

function install(): void {
  try {
    const g = globalThis as unknown as Record<string, unknown>;
    g.__takeDiagDump = () => BUFFER.join('\n');
    g.__takeDiagClear = () => {
      BUFFER.length = 0;
      seq = 0;
      t0 = 0;
      console.log('[TAKEDIAG] cleared');
    };
    console.log('[TAKEDIAG] armed — __takeDiagClear() before a case, __takeDiagDump() after it');
  } catch {
    /* no global to hang it off (SSR / test runner) — the console lines remain */
  }
}

install();
