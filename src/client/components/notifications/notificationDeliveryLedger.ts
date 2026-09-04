/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 *
 * THE PERSISTENT DELIVERY LEDGER — what lets a consumer session die without
 * taking undelivered notifications with it.
 *
 * The seen-sets, the PREPARING stage and the FIFO queue are all in-memory: a
 * Steam Deck suspend, a TV app restart or a crash between «the chain closed»
 * and «the band presented» used to convert a personal payout into «old news»
 * the next session's silent seed swallowed (the 2026-09-04 audit, hole B).
 * The ledger persists, per viewer, exactly two facts after every ingest pass:
 *
 *  - `watermark` — the highest event id this consumer has PROCESSED;
 *  - `undelivered` — the correlation ids that were still in PREPARING or in
 *    the queue (released but not yet presented) at the end of the pass.
 *
 * The next session's first seed then distinguishes three cases instead of
 * one: a chain at/below the watermark and not undelivered is genuinely old
 * news (swallowed, as always); a chain ABOVE the watermark landed while the
 * app was away; an UNDELIVERED chain was already released but never reached
 * the screen — both of the latter present normally.
 *
 * Storage: `localStorage` when the host provides it (browser / Electron), an
 * in-memory map otherwise (unit runners) — the fallback keeps the semantics
 * testable and degrades to the old behaviour only across real process death
 * in an environment with no storage at all.
 */

export type DeliveryLedger = {
  watermark: number;
  undelivered: Array<number>;
};

const PREFIX = 'tm_notif_ledger:';

const memoryStore = new Map<string, string>();

function storage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined {
  try {
    const s = (globalThis as {localStorage?: Storage}).localStorage;
    if (s !== undefined) {
      return s;
    }
  } catch (err) {
    // Storage access can throw (privacy mode) — fall through to memory.
  }
  return {
    getItem: (k) => memoryStore.get(k) ?? null,
    setItem: (k, v) => void memoryStore.set(k, v),
    removeItem: (k) => void memoryStore.delete(k),
  };
}

export function loadDeliveryLedger(key: string): DeliveryLedger | undefined {
  try {
    const raw = storage()?.getItem(PREFIX + key);
    if (raw === null || raw === undefined) {
      return undefined;
    }
    const parsed = JSON.parse(raw) as Partial<DeliveryLedger>;
    if (typeof parsed.watermark !== 'number' || !Array.isArray(parsed.undelivered)) {
      return undefined;
    }
    return {watermark: parsed.watermark, undelivered: parsed.undelivered.filter((n) => typeof n === 'number')};
  } catch (err) {
    return undefined; // a corrupt ledger degrades to the old (no-ledger) seed
  }
}

export function saveDeliveryLedger(key: string, ledger: DeliveryLedger): void {
  try {
    storage()?.setItem(PREFIX + key, JSON.stringify(ledger));
  } catch (err) {
    // Quota / privacy failures are non-fatal: the ledger is a rescue net.
  }
}

/** Test seam: forget every in-memory ledger. */
export function resetDeliveryLedgersForTesting(): void {
  memoryStore.clear();
}
