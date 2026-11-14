/*
 * THE CAUSE OF A STALL — one key for one defect, wherever its line is read.
 *
 * A stall of the console is a wait nobody ended, and a net's line names it. Until this module the line was grouped by
 * its WORDS (`normalizeMessage(title)`) or, for the arbiter's episode, by «reason + asked + healed»: every `unserved,
 * asked card` was one issue whatever held the question, and one cause said in two wordings was two.
 *
 * `causeOf(line)` is a PURE function of the line's text: the SHAPE table (`shapes.ts`) says what the line is and which
 * of its words are STRUCTURAL (a workspace kind, a phase, a hold's label, a wait's id without its run number, an
 * admission block); the class is the shape followed by those words. So the same key is computed
 *   · by the page (the in-game journal, the record it sends to the hub),
 *   · by the hub (the main process's and the game server's own lines; the event's fingerprint),
 *   · by the e2e harvest and the monkey's report (they only have the console's text),
 * and a field case finds its reproducing spec by that key. What must NOT split a class — the outcome, the net that
 * cured, the source card, the duration — is a DIMENSION (`DiagCause.dims`, an event's tags).
 *
 * Pure: no clock, no runtime.
 */

import {classifyLine} from './classify';
import {DiagCause, DiagCure, DiagEpisode, DiagEpisodeOutcome, DiagEvidence, DiagLevel} from './DiagnosticModel';
import {shapeOf} from './shapes';

/** The longest class a consumer keys by (a Sentry tag's value holds 200 characters). */
export const CAUSE_CLASS_MAX = 180;

/**
 * One structural word of a class: what varies between two occurrences of ONE cause is taken out — a run's number
 * (`#12`), any digits (a prompt id, a stage's index), quotes and brackets — and what is left is lower-cased and joined
 * by dashes. `admission:host#12` → `admission:host`; `«colonies»` → `colonies`; `hand:committed` stays.
 */
export function causePart(raw: string): string {
  return raw
    .replace(/#[0-9a-z]*/gi, '')
    .replace(/[«»"'`()[\]{}]/g, '')
    .replace(/\d+(?:\.\d+)?/g, 'N')
    .trim()
    .toLowerCase()
    .replace(/[\s,;|]+/g, '-')
    // `/` joins the words of a class: inside one word (a section `board/journal`) it is a dot.
    .replace(/\/+/g, '.')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 60);
}

/** The class of a shape and its parts, within the bound (an over-long tail is cut — the head names the defect). */
export function causeClass(shape: string, parts: ReadonlyArray<string>): string {
  const words = parts.map(causePart).filter((p) => p !== '');
  return [shape, ...words].join('/').slice(0, CAUSE_CLASS_MAX);
}

/**
 * The cause of one console line — `undefined` for a line that is not a stall or an integrity warning (an exception is
 * grouped by its stack, a note is never grouped at all).
 */
export function causeOf(text: string, level: DiagLevel): DiagCause | undefined {
  const cls = classifyLine(text, level);
  if (cls.kind !== 'stall' && cls.kind !== 'integrity') {
    return undefined;
  }
  const shape = shapeOf(text.split('\n')[0], cls.family);
  return {cls: causeClass(shape.id, shape.parts), shape: shape.id, tier: shape.tier, dims: {...shape.dims}};
}

/** How long an episode stood, as a word a reader can slice by. */
export function durationBucket(ms: number): string {
  const s = ms / 1000;
  if (s < 5) {
    return 'under-5s';
  }
  if (s < 10) {
    return '5-10s';
  }
  if (s < 20) {
    return '10-20s';
  }
  if (s < 40) {
    return '20-40s';
  }
  return 'over-40s';
}

/** A step that released nothing (`rank 10: nothing to release`) or the ladder's last word. */
function idleStep(step: string): boolean {
  return /nothing to release$/.test(step) || /the ladder is spent$/.test(step) || step.trim() === '';
}

/**
 * WHO CURED IT — the releases of the LAST step that did something. The arbiter prints a rung as
 * `rung 2: <release>: <what it did> · <release>: <what>` (several modules share a rank); a rung's empty predecessors
 * stand in front of it as `rank N: nothing to release · …`.
 */
export function cureOf(steps: ReadonlyArray<string>): {by: string, did: string} {
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (idleStep(step)) {
      continue;
    }
    const body = step.replace(/^rung \d+:\s*/, '');
    const acted = body.split(' · ').filter((piece) => !idleStep(piece));
    if (acted.length === 0) {
      continue;
    }
    const names = acted.map((piece) => /^([a-z][a-z0-9-]*):/i.exec(piece.trim())?.[1]).filter((n): n is string => n !== undefined);
    return {by: [...new Set(names)].join('+'), did: acted.join(' · ').slice(0, 400)};
  }
  return {by: '', did: ''};
}

/** The scope a tree line is about (`  frame:hand#3 4.2s committed  ⟵ waits …` → `frame:hand#3`). */
function treeScope(line: string): string {
  return line.trim().split(' ')[0];
}

/**
 * WHAT CHANGED BY THE CURE — what stood at the start of an episode and no longer stands at its end: the scopes that
 * ended (by the RUN's own id, so a new run of the same flow is not «the same scope»), the holders that let go, a
 * question that moved on. Bounded; an empty list is itself evidence (the picture moved, the structure did not).
 */
export function evidenceDelta(start: DiagEvidence | undefined, end: DiagEvidence | undefined, max = 14): Array<string> {
  if (start === undefined || end === undefined) {
    return [];
  }
  const out: Array<string> = [];
  if (start.question !== end.question) {
    out.push(`question: ${start.question} → ${end.question}`);
  }
  const after = new Set(end.tree.map(treeScope));
  for (const line of start.tree) {
    const scope = treeScope(line);
    if (scope !== '' && !after.has(scope)) {
      out.push(`ended: ${line.trim()}`);
    }
  }
  const holding = new Set(end.holders.map((h) => h.replace(/\s+\d+(?:\.\d+)?s$/, '')));
  for (const holder of start.holders) {
    if (!holding.has(holder.replace(/\s+\d+(?:\.\d+)?s$/, ''))) {
      out.push(`let go: ${holder}`);
    }
  }
  const before = new Set(start.tree.map(treeScope));
  const opened = end.tree.filter((line) => !before.has(treeScope(line))).length;
  if (opened > 0) {
    out.push(`opened: ${opened} scope(s)`);
  }
  return out.length <= max ? out : [...out.slice(0, max), `… +${out.length - max} more`];
}

/** An episode's cure, once it has ended: who, in what words, and what was different after. */
export function episodeCure(episode: DiagEpisode, start: DiagEvidence | undefined, end: DiagEvidence | undefined): DiagCure {
  return {...cureOf(episode.steps), changed: evidenceDelta(start, end)};
}

/**
 * The dimensions an event of this record is tagged with — the cause's own, and for an episode how it ended, how long it
 * stood and who cured it. Every value is short and structural (a tag, never a sentence).
 */
export function causeDims(cause: DiagCause, episode?: DiagEpisode): Record<string, string> {
  const dims: Record<string, string> = {...cause.dims};
  if (episode !== undefined) {
    const outcome: DiagEpisodeOutcome | 'standing' = episode.outcome ?? (episode.state === 'healed' ? 'healed' : episode.state === 'unhealed' ? 'unhealed' : 'standing');
    dims.outcome = outcome;
    dims.stood = durationBucket(episode.durationMs);
    const by = episode.cure?.by ?? cureOf(episode.steps).by;
    if (by !== '') {
      dims.cure = by;
    }
  }
  return dims;
}
