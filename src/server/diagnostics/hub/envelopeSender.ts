/*
 * THE ONE DOOR OUT — envelopes to the collector, and a disk OUTBOX for when the network is away.
 *
 * The protocol is Sentry's envelope over HTTPS (`@sentry/core` serialises it; nothing else of the SDK runs here —
 * no global handlers, no integrations, no second interceptor beside the game's own). What this file adds is what a
 * game on a couch needs and a browser SDK does not have:
 *
 *  · NOTHING IS LOST TO A MISSING NETWORK. An envelope that could not be delivered is written to
 *    `<userData>/diagnostics/outbox/` and sent when the network returns — in this run or after the next launch. A
 *    player's explicit report always gets a place there; automatic events share a bounded number of places.
 *  · THE ANSWER IS KNOWN. `send` resolves `sent` only when the collector accepted the envelope (HTTP 200) — the report
 *    surface says «отчёт у разработчика» on that word, and «уйдёт при подключении» on `queued`.
 *  · A REFUSAL IS NOT RETRIED FOR EVER: a 4xx other than 429 is the collector's verdict on the envelope (too large, a
 *    wrong key) — it is dropped and said; a 429 / 5xx / a network error waits in the outbox.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import {createAttachmentEnvelopeItem, createEnvelope, serializeEnvelope} from '@sentry/core';

export type HubRequest = (url: string, init: {method: 'POST', headers: Record<string, string>, body: Uint8Array}) =>
  Promise<{status: number, headers: Record<string, string | undefined>}>;

export type EnvelopeAttachment = {
  filename: string;
  data: Uint8Array | string;
  contentType?: string;
};

/** `report` — a player's explicit report (always kept). `auto` — an automatic event (kept while there is room). */
export type EnvelopeClass = 'report' | 'auto';

export type SendOutcome =
  {state: 'sent'} |
  {state: 'queued', reason: string} |
  {state: 'dropped', reason: string};

export const OUTBOX_AUTO_MAX = 30;
export const OUTBOX_REPORT_MAX = 12;
const FLUSH_EVERY_MS = 60_000;
/** A request that does not answer is a network that is away. */
const REQUEST_MAX_MS = 45_000;

/** One event with its attachments as envelope bytes (not compressed — the sender compresses on the wire). */
export function eventEnvelope(event: Record<string, unknown> & {event_id: string}, attachments: ReadonlyArray<EnvelopeAttachment>, sentAt: number): Uint8Array {
  const items: Array<unknown> = [[{type: 'event'}, event]];
  for (const a of attachments) {
    items.push(createAttachmentEnvelopeItem({filename: a.filename, data: a.data, contentType: a.contentType ?? 'application/octet-stream'}));
  }
  const envelope = createEnvelope(
    {event_id: event.event_id, sent_at: new Date(sentAt).toISOString()} as never,
    items as never,
  );
  const serialized = serializeEnvelope(envelope);
  return typeof serialized === 'string' ? new TextEncoder().encode(serialized) : serialized;
}

export type EnvelopeSenderOptions = {
  /** The collector's envelope endpoint; undefined = this run sends nothing (every `send` answers `dropped`). */
  url: string | undefined;
  outboxDir: string;
  request: HubRequest;
  now: () => number;
  /** A one-shot timer; returns its cancel. */
  schedule: (ms: number, run: () => void) => () => void;
  /** Called after anything changed (a delivery, a queueing) — the hub pushes its status. */
  onChange?: () => void;
  /** Whether the outbox may be flushed right now (the player's consent covers what was queued by itself). */
  mayFlush?: (klass: EnvelopeClass) => boolean;
};

export class EnvelopeSender {
  lastDeliveredAt = 0;
  lastError = '';
  private retryNotBefore = 0;
  private flushing = false;
  private cancelTimer: (() => void) | undefined;

  constructor(private readonly options: EnvelopeSenderOptions) {}

  /** Envelopes waiting in the outbox. */
  queued(): number {
    return this.outboxFiles().length;
  }

  private outboxFiles(): Array<string> {
    try {
      return fs.readdirSync(this.options.outboxDir).filter((f) => f.endsWith('.env.gz')).sort();
    } catch {
      return [];
    }
  }

  /** Deliver now, or keep for later. Never throws. */
  async send(bytes: Uint8Array, klass: EnvelopeClass, id: string): Promise<SendOutcome> {
    if (this.options.url === undefined) {
      return {state: 'dropped', reason: 'this build sends nothing'};
    }
    const body = await gzip(bytes);
    const outcome = this.options.now() < this.retryNotBefore ?
      {state: 'queued' as const, reason: 'the collector asked to wait'} :
      await this.deliver(body);
    if (outcome.state === 'queued') {
      return this.keep(body, klass, id, outcome.reason);
    }
    if (outcome.state === 'sent') {
      // The road is open: whatever waited goes now.
      void this.flush();
    }
    this.options.onChange?.();
    return outcome;
  }

  private async deliver(body: Uint8Array): Promise<SendOutcome> {
    const url = this.options.url;
    if (url === undefined) {
      return {state: 'dropped', reason: 'this build sends nothing'};
    }
    try {
      const response = await withDeadline(
        this.options.request(url, {
          method: 'POST',
          headers: {'Content-Type': 'application/x-sentry-envelope', 'Content-Encoding': 'gzip'},
          body,
        }),
        REQUEST_MAX_MS, this.options.schedule);
      if (response.status >= 200 && response.status < 300) {
        this.lastDeliveredAt = this.options.now();
        this.lastError = '';
        return {state: 'sent'};
      }
      if (response.status === 429 || response.status >= 500) {
        const after = Number(response.headers['retry-after'] ?? '');
        this.retryNotBefore = this.options.now() + (Number.isFinite(after) && after > 0 ? Math.min(after, 3600) * 1000 : 60_000);
        this.lastError = `the collector answered ${response.status}`;
        return {state: 'queued', reason: this.lastError};
      }
      this.lastError = `the collector refused the envelope (${response.status})`;
      return {state: 'dropped', reason: this.lastError};
    } catch (err) {
      this.lastError = `no connection (${err instanceof Error ? err.message : String(err)})`.slice(0, 200);
      return {state: 'queued', reason: this.lastError};
    }
  }

  private keep(body: Uint8Array, klass: EnvelopeClass, id: string, reason: string): SendOutcome {
    try {
      fs.mkdirSync(this.options.outboxDir, {recursive: true});
      const files = this.outboxFiles();
      const mine = files.filter((f) => f.startsWith(`${klass}-`));
      const max = klass === 'report' ? OUTBOX_REPORT_MAX : OUTBOX_AUTO_MAX;
      if (mine.length >= max) {
        if (klass === 'auto') {
          // The outbox keeps the FIRST automatic events of an outage — they name what began it.
          this.options.onChange?.();
          return {state: 'dropped', reason: 'the outbox is full'};
        }
        fs.rmSync(path.join(this.options.outboxDir, mine[0]), {force: true});
      }
      const name = `${klass}-${String(this.options.now()).padStart(15, '0')}-${id.replace(/[^A-Za-z0-9-]/g, '')}.env.gz`;
      fs.writeFileSync(path.join(this.options.outboxDir, name), body);
      this.arm();
      this.options.onChange?.();
      return {state: 'queued', reason};
    } catch (err) {
      this.options.onChange?.();
      return {state: 'dropped', reason: `the outbox could not be written (${err instanceof Error ? err.message : String(err)})`};
    }
  }

  /** Try to empty the outbox, oldest first; stops at the first envelope that still cannot leave. */
  async flush(): Promise<void> {
    if (this.flushing || this.options.url === undefined) {
      return;
    }
    this.flushing = true;
    try {
      for (const name of this.outboxFiles()) {
        const klass: EnvelopeClass = name.startsWith('report-') ? 'report' : 'auto';
        if (this.options.mayFlush !== undefined && !this.options.mayFlush(klass)) {
          continue;
        }
        if (this.options.now() < this.retryNotBefore) {
          break;
        }
        const file = path.join(this.options.outboxDir, name);
        let body: Uint8Array;
        try {
          body = fs.readFileSync(file);
        } catch {
          continue;
        }
        const outcome = await this.deliver(body);
        if (outcome.state === 'queued') {
          break;
        }
        // Sent, or refused for good — either way it does not wait any longer.
        fs.rmSync(file, {force: true});
        this.options.onChange?.();
      }
    } finally {
      this.flushing = false;
      if (this.queued() > 0) {
        this.arm();
      }
    }
  }

  /** A player who switched automatic reports off takes back what was queued by itself. */
  dropQueued(klass: EnvelopeClass): void {
    for (const name of this.outboxFiles()) {
      if (name.startsWith(`${klass}-`)) {
        fs.rmSync(path.join(this.options.outboxDir, name), {force: true});
      }
    }
    this.options.onChange?.();
  }

  /** The next look at the outbox (one timer at a time). */
  arm(delayMs: number = FLUSH_EVERY_MS): void {
    if (this.cancelTimer !== undefined) {
      return;
    }
    this.cancelTimer = this.options.schedule(delayMs, () => {
      this.cancelTimer = undefined;
      void this.flush();
    });
  }

  stop(): void {
    this.cancelTimer?.();
    this.cancelTimer = undefined;
  }
}

function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zlib.gzip(bytes, (err, out) => (err !== null ? reject(err) : resolve(out)));
  });
}

function withDeadline<T>(work: Promise<T>, ms: number, schedule: (ms: number, run: () => void) => () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const cancel = schedule(ms, () => reject(new Error(`no answer in ${Math.round(ms / 1000)}s`)));
    work.then((value) => {
      cancel();
      resolve(value);
    }, (err) => {
      cancel();
      reject(err);
    });
  });
}
