/**
 * BOT-TURN TIMING — the diagnostic that answers «why did the bot take five
 * seconds?».
 *
 * Every candidate answer is CLIENT-side and invisible from the outside: the
 * server resolves a turn in under a millisecond and broadcasts it, and what
 * follows is a presentation pipeline with three places to wait —
 *
 *   1. the STAGING window (`marsBotStagedCommits`) buffers the authoritative
 *      view, so the player's own next prompt only exists once the turn's
 *      compact card has been DELIVERED;
 *   2. the notification QUEUE holds that card while the feed is silenced (a
 *      live cinematic, a full-bleed reveal, a ceremony);
 *   3. the delivered card itself HOLDS every prompt surface (`holdsFlow` →
 *      `mandatoryPromptsHeld`) for as long as it is on screen.
 *
 * From the player's seat all three look identical: the bot's chip stays
 * «Действие» and nothing happens. So each stage is stamped here and the whole
 * turn reports as ONE line naming where the time actually went.
 *
 * Always collecting (four small marks per turn, bounded ring); it PRINTS when
 * `?botTiming=1` / `tm_bot_timing` is on, and WARNS on its own whenever a turn
 * took longer than {@link SLOW_TURN_WARN_MS} — a silent slow path is exactly
 * the bug this module exists to stop shipping.
 */

/** The ordered stages of one bot turn's client-side life. */
export type BotTurnStage =
  /** The response carrying this turn reached the client. */
  | 'response'
  /** The view was committed — the player's own next prompt now exists. */
  | 'commit'
  /** The compact card became VISIBLE (it holds prompt surfaces from here). */
  | 'visible'
  /** The card left the presentation — nothing of this turn holds anything. */
  | 'released';

const STAGE_ORDER: ReadonlyArray<BotTurnStage> = ['response', 'commit', 'visible', 'released'];

/** Past this, a turn is reported even with diagnostics off. */
export const SLOW_TURN_WARN_MS = 1_500;

/** Keep the last few turns only — this is a live diagnostic, not a log. */
const RING = 12;

export type BotTurnTimingRecord = {
  readonly key: string;
  /** When `response` was stamped — every other mark is relative to it. */
  readonly baseline: number;
  /** Stage → ms since this turn's `response` mark (0 for `response` itself). */
  readonly marks: Map<BotTurnStage, number>;
  /** Free-text notes per stage (`staged` / the block that queued the card). */
  readonly notes: Map<BotTurnStage, string>;
  reported: boolean;
};

const records: Array<BotTurnTimingRecord> = [];

function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ?
    performance.now() : Date.now();
}

function searchString(): string {
  return typeof window === 'undefined' ? '' : window.location.search;
}

function stored(): string | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : (localStorage.getItem('tm_bot_timing') ?? undefined);
  } catch (e) {
    return undefined;
  }
}

/** Print every turn's breakdown (`?botTiming=1`, or `tm_bot_timing=1`). */
export function botTurnTimingEnabled(): boolean {
  const fromUrl = /[?&]botTiming=([01])/.exec(searchString())?.[1];
  if (fromUrl !== undefined) {
    return fromUrl === '1';
  }
  return stored() === '1';
}

function recordFor(key: string): BotTurnTimingRecord | undefined {
  return records.find((r) => r.key === key);
}

/**
 * Stamp a stage. The `response` mark OPENS a record (a later stage for an
 * unknown turn is dropped rather than inventing a zero baseline), and
 * `released` closes it out with the report.
 */
export function noteBotTurnStage(key: string, stage: BotTurnStage, note?: string): void {
  if (key === '') {
    return;
  }
  if (stage === 'response') {
    if (recordFor(key) !== undefined) {
      return; // a re-poll of the same turn is not a second arrival
    }
    const fresh: BotTurnTimingRecord = {
      key,
      baseline: now(),
      marks: new Map<BotTurnStage, number>([['response', 0]]),
      notes: new Map<BotTurnStage, string>(),
      reported: false,
    };
    if (note !== undefined) {
      fresh.notes.set('response', note);
    }
    records.push(fresh);
    while (records.length > RING) {
      records.shift();
    }
    return;
  }
  const record = recordFor(key);
  if (record === undefined) {
    return;
  }
  if (!record.marks.has(stage)) {
    record.marks.set(stage, Math.round(now() - record.baseline));
  }
  if (note !== undefined) {
    record.notes.set(stage, note);
  }
  if (stage === 'released') {
    report(record);
  }
}

/** The one-line breakdown — «what took the time», never a raw dump. */
export function botTurnTimingLine(record: BotTurnTimingRecord): string {
  const parts: Array<string> = [];
  for (const stage of STAGE_ORDER) {
    if (stage === 'response') {
      continue;
    }
    const at = record.marks.get(stage);
    if (at === undefined) {
      continue;
    }
    const note = record.notes.get(stage);
    parts.push(`${stage}=${at}ms${note !== undefined ? ` (${note})` : ''}`);
  }
  const opening = record.notes.get('response');
  return `[bot-turn] ${record.key}${opening !== undefined ? ` ${opening}` : ''} — ${parts.join(' · ') || 'no stages'}`;
}

function report(record: BotTurnTimingRecord): void {
  if (record.reported) {
    return;
  }
  record.reported = true;
  const commit = record.marks.get('commit') ?? 0;
  if (botTurnTimingEnabled()) {
    console.log(botTurnTimingLine(record));
  } else if (commit > SLOW_TURN_WARN_MS) {
    // The player waited this long for their OWN next prompt. Name it even with
    // diagnostics off: this delay has no other observable trace.
    console.warn(`${botTurnTimingLine(record)} — commit took over ${SLOW_TURN_WARN_MS}ms`);
  }
}

/** Live records, newest last (the `?gpDebug` readout + specs). */
export function botTurnTimingRecords(): ReadonlyArray<BotTurnTimingRecord> {
  return records;
}

/** How long THIS turn took to reach the player's next prompt, in ms. */
export function botTurnCommitLag(key: string): number | undefined {
  return recordFor(key)?.marks.get('commit');
}

export function resetBotTurnTiming(): void {
  records.length = 0;
}

/*
 * READ-ONLY e2e / diagnostics probe (the `__conColonyDiag` / `__stratDiag`
 * idiom): every recorded turn with its stage breakdown, so a latency claim is
 * settled by the client's own numbers instead of by watching pixels. Never used
 * by product code.
 */
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__botTurnDiag = () => botTurnTimingRecords().map((r) => ({
    key: r.key,
    marks: Object.fromEntries(r.marks),
    notes: Object.fromEntries(r.notes),
  }));
}
