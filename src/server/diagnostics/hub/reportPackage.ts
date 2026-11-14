/*
 * THE REPORT PACKAGE — everything an agent needs to understand and reproduce a problem, in ONE layout.
 *
 * The same files stand in the folder on the player's device (`<userData>/diagnostics/reports/TM-XXXXXX/`) and ride the
 * report's event as attachments, so «what the developer got» and «what is on my disk» are the same thing:
 *
 *   report.json          who, what, where: the code, the category, the player's words, the build, the screen, the status
 *   journal.json         the diagnostics journal — every record with its full text
 *   field_record.json    the field recorder's ring: the screen second by second before the press
 *   console_export.txt   the renderer's whole console with its digests (errors · stalls · screen)
 *   screen.jpg           the frame the player saw BEFORE the menu covered it
 *   save.json            the game's save — only when this device hosts the game (`app_mode: host`)
 *   hang_trace.json      the newest Chromium trace of a renderer stop, if one was written lately
 *   log_<name>.txt       tails of the logs beside the game (the embedded server's, the main process's, the wrapper's)
 *
 * BOUNDED, each part by its own budget and the whole far under the collector's limits; a part that was cut says so
 * (`truncated`, and a first line in the text itself) — a tail is kept, because the end of a log is what names the cause.
 *
 * This is the EXPLICIT road: the player pressed «Отправить» on a surface that listed these parts. Nothing here is
 * scrubbed; nothing here is ever sent by itself.
 */

import * as fs from 'fs';
import * as path from 'path';
import {DiagReportPart, DiagReportRequest} from '@/common/diagnostics/protocol';
import {HubHost} from './hubTypes';

export type ReportPart = {
  name: string;
  data: Uint8Array;
  contentType: string;
  truncated: boolean;
};

/** Per-part budgets, bytes. Their sum is the package's ceiling (≈ 19 MB raw; text compresses several times on the wire). */
export const REPORT_BUDGET = {
  journal: 2 * 1024 * 1024,
  fieldRecord: 1024 * 1024,
  console: 5 * 1024 * 1024,
  screen: 2 * 1024 * 1024,
  save: 6 * 1024 * 1024,
  hangTrace: 2 * 1024 * 1024,
  logTail: 256 * 1024,
} as const;

/** Reports kept on the device (the oldest folders go). */
export const REPORTS_KEPT = 20;

const encoder = new TextEncoder();

/** The END of a text within `maxBytes` (UTF-8), with a first line saying what was cut. Pure. */
export function tailWithin(text: string, maxBytes: number): {text: string, truncated: boolean} {
  const bytes = encoder.encode(text);
  if (bytes.length <= maxBytes) {
    return {text, truncated: false};
  }
  const notice = `… (the first ${bytes.length - maxBytes} bytes were cut to fit the report) …\n`;
  const keep = Math.max(0, maxBytes - encoder.encode(notice).length);
  // Cut on a character boundary: step forward past UTF-8 continuation bytes.
  let from = bytes.length - keep;
  while (from < bytes.length && (bytes[from] & 0xC0) === 0x80) {
    from++;
  }
  return {text: notice + new TextDecoder().decode(bytes.subarray(from)), truncated: true};
}

function textPart(name: string, text: string, maxBytes: number, contentType = 'text/plain'): ReportPart {
  const cut = tailWithin(text, maxBytes);
  return {name, data: encoder.encode(cut.text), contentType, truncated: cut.truncated};
}

/** JSON within its budget: an array loses its OLDEST members first (the journal's latest records are what matter). */
function jsonPart(name: string, value: unknown, maxBytes: number): ReportPart {
  let json = JSON.stringify(value, null, 1);
  let truncated = false;
  if (Array.isArray(value)) {
    let list = value;
    while (encoder.encode(json).length > maxBytes && list.length > 1) {
      list = list.slice(Math.ceil(list.length / 4));
      json = JSON.stringify(list, null, 1);
      truncated = true;
    }
  }
  if (encoder.encode(json).length > maxBytes) {
    return {...textPart(name, json, maxBytes, 'application/json'), truncated: true};
  }
  return {name, data: encoder.encode(json), contentType: 'application/json', truncated};
}

async function attempt<T>(work: () => Promise<T>, host: HubHost, what: string): Promise<T | undefined> {
  try {
    return await work();
  } catch (err) {
    host.log(`[diagnostics] the report has no ${what}: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
}

export type ReportMeta = Record<string, unknown>;

/**
 * Every part this host can give for this request, in the package's order. A part the host cannot produce (no screen,
 * no hosted save, a dump that threw) is simply absent — a report with fewer parts is still a report.
 */
export async function gatherReportParts(host: HubHost, request: DiagReportRequest, meta: ReportMeta, now: number): Promise<Array<ReportPart>> {
  const parts: Array<ReportPart> = [];
  parts.push(jsonPart('journal.json', request.journal, REPORT_BUDGET.journal));
  if (request.fieldRecord !== undefined && request.fieldRecord !== null) {
    parts.push(jsonPart('field_record.json', request.fieldRecord, REPORT_BUDGET.fieldRecord));
  }
  const dump = await attempt(() => host.consoleDump(), host, 'console export');
  if (dump !== undefined && dump !== '') {
    parts.push(textPart('console_export.txt', dump, REPORT_BUDGET.console));
  }
  const screen = await attempt(() => host.heldScreenJpeg(), host, 'screen');
  if (screen !== undefined && screen.length > 0 && screen.length <= REPORT_BUDGET.screen) {
    parts.push({name: 'screen.jpg', data: screen, contentType: 'image/jpeg', truncated: false});
  }
  // The save travels only from the device that HOSTS the game: there it is the player's own file; a thin client has none.
  if (host.appMode() === 'host' && request.context.participantId !== '') {
    const save = await attempt(() => host.readSave(request.context.participantId), host, 'save');
    if (save !== undefined && save.data.length > 0) {
      meta.saveGameId = save.gameId;
      if (save.data.length <= REPORT_BUDGET.save) {
        parts.push({name: 'save.json', data: save.data, contentType: 'application/json', truncated: false});
      } else {
        meta.saveOmitted = `the save is ${save.data.length} bytes — over the report's budget; it stays on the device`;
      }
    }
  }
  const trace = await attempt(() => host.recentHangTrace(now - 30 * 60_000, REPORT_BUDGET.hangTrace), host, 'hang trace');
  if (trace !== undefined) {
    parts.push({name: 'hang_trace.json', data: trace.data, contentType: 'application/json', truncated: false});
    meta.hangTrace = trace.name;
  }
  for (const tail of await attempt(() => host.logTails(REPORT_BUDGET.logTail), host, 'log tails') ?? []) {
    parts.push(textPart(`log_${tail.name.replace(/[^A-Za-z0-9._-]/g, '_')}.txt`, tail.text, REPORT_BUDGET.logTail));
  }
  // `report.json` is written LAST (it lists the parts) and stands FIRST.
  meta.parts = parts.map((p) => ({name: p.name, bytes: p.data.length, truncated: p.truncated}));
  parts.unshift({name: 'report.json', data: encoder.encode(JSON.stringify(meta, null, 1)), contentType: 'application/json', truncated: false});
  return parts;
}

export function describeParts(parts: ReadonlyArray<ReportPart>): Array<DiagReportPart> {
  return parts.map((p) => ({name: p.name, bytes: p.data.length, truncated: p.truncated}));
}

/** The package as a folder on the device; older folders beyond `REPORTS_KEPT` go. Returns the folder. */
export function writeReportFolder(reportsDir: string, code: string, parts: ReadonlyArray<ReportPart>): string {
  const folder = path.join(reportsDir, code);
  fs.mkdirSync(folder, {recursive: true});
  for (const part of parts) {
    fs.writeFileSync(path.join(folder, part.name), part.data);
  }
  try {
    const all = fs.readdirSync(reportsDir, {withFileTypes: true})
      .filter((d) => d.isDirectory() && /^TM-/.test(d.name))
      .map((d) => ({name: d.name, at: fs.statSync(path.join(reportsDir, d.name)).mtimeMs}))
      .sort((a, b) => b.at - a.at);
    for (const old of all.slice(REPORTS_KEPT)) {
      fs.rmSync(path.join(reportsDir, old.name), {recursive: true, force: true});
    }
  } catch {
    // Pruning is housekeeping; the report itself is written.
  }
  return folder;
}
