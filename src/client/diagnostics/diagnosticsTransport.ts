/*
 * THE PAGE'S ROAD TO THE HUB — one seam, so the page never knows where its diagnostics go.
 *
 * Today there are two roads: the DESKTOP one (the Electron shell's bridge → the hub in the main process) and NONE (a
 * browser page of a server that runs no hub yet: the journal still works on the page, nothing leaves it). The hosted
 * server and the replica will add a third — the same protocol over HTTP — by returning another object from
 * `resolveTransport`; nothing above this file changes (`docs/claude/diagnostics.md` § The seams).
 *
 * The protocol itself is `src/common/diagnostics/protocol.ts`.
 */

import {desktopBridge} from '@/client/components/desktop/desktopUpdateState';
import {DiagInvoke, DiagPush, DiagSend, DiagVerb} from '@/common/diagnostics/protocol';

export type DiagnosticsTransport = {
  /** `desktop` — a hub answers. `none` — nobody does: every question resolves `undefined`, every line is dropped. */
  readonly kind: 'desktop' | 'none';
  invoke<V extends DiagVerb>(verb: V, request: DiagInvoke[V]['request']): Promise<DiagInvoke[V]['response'] | undefined>;
  send(line: DiagSend): void;
  /** What the hub pushes; one subscription per page is enough (the journal state's). */
  onPush(listener: (push: DiagPush) => void): void;
};

const NONE: DiagnosticsTransport = {
  kind: 'none',
  invoke: () => Promise.resolve(undefined),
  send: () => undefined,
  onPush: () => undefined,
};

/**
 * THE STAND'S SEAM — `window.__tmDiagTransport`, set BEFORE the page loads (an e2e's init script, a visual stand): a
 * hub of the caller's own, answering the same protocol. It is how the surface is driven in a browser, where no main
 * process exists — the report's beat, its code, a queued report, a refusal, the connection check — without the page
 * pretending to be the desktop app in any other respect. Never set by the product.
 */
type StandTransport = {
  invoke(verb: string, request: unknown): Promise<unknown>;
  send(line: unknown): void;
  onPush(listener: (push: unknown) => void): void;
};

function resolveTransport(): DiagnosticsTransport {
  const stand = typeof window === 'undefined' ? undefined : (window as unknown as {__tmDiagTransport?: StandTransport}).__tmDiagTransport;
  if (stand !== undefined) {
    return {
      kind: 'desktop',
      invoke: async (verb, request) => {
        try {
          return await stand.invoke(verb, request) as never;
        } catch {
          return undefined;
        }
      },
      send: (line) => stand.send(line),
      onPush: (listener) => stand.onPush((push) => listener(push as DiagPush)),
    };
  }
  const bridge = desktopBridge();
  if (bridge === undefined || bridge.diagInvoke === undefined || bridge.diagSend === undefined) {
    return NONE;
  }
  const invokeBridge = bridge.diagInvoke.bind(bridge);
  const sendBridge = bridge.diagSend.bind(bridge);
  return {
    kind: 'desktop',
    invoke: async (verb, request) => {
      try {
        return await invokeBridge(verb, request) as never;
      } catch {
        // A hub that does not answer is a hub that is not there: the surface says «недоступно», never throws.
        return undefined;
      }
    },
    send: (line) => {
      try {
        sendBridge(line);
      } catch {
        // The page must never fail because its diagnostics could not be carried.
      }
    },
    onPush: (listener) => {
      bridge.onDiagEvent?.((event) => listener(event as DiagPush));
    },
  };
}

let resolved: DiagnosticsTransport | undefined;

export function diagnosticsTransport(): DiagnosticsTransport {
  resolved ??= resolveTransport();
  return resolved;
}

/** Spec seam (and the e2e stand's): a transport of the caller's own; `undefined` resolves the real one again. */
export function __setDiagnosticsTransportForTesting(transport: DiagnosticsTransport | undefined): void {
  resolved = transport;
}
