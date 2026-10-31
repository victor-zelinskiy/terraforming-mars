import * as fs from 'fs';
import * as path from 'path';
import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';

/**
 * POST /api/field-log — THE FIELD FLIGHT RECORDER's drop box (`client/console/fieldRecorder.ts`, phase 2 of the start
 * director). A console posts the diagnostic lines it named and the liveness arbiter's last heartbeats — batched while
 * it lives, the previous session's record on the next boot of the same page (the reload that re-primed a frozen
 * prompt), a beacon on `pagehide`. Appended as ONE JSON line each to `<db folder>/field-log/<YYYY-MM-DD>.jsonl`
 * (`TM_DB_FOLDER`'s parent as SQLite reads it, else `<cwd>/db`; `TM_FIELD_LOG_DIR` overrides — the tests write into a temp dir), beside the saves the index reads
 * (`scripts/field-opening-index.cjs`), so a freeze's screen and its save can be laid side by side.
 *
 * Open to every client of this server (the LAN seat posts its own screen's record); bounded (`BODY_MAX` bytes,
 * a JSON object with a `kind` and a `record`), never echoed back, never read by the game.
 */
export class ApiFieldLog extends Handler {
  public static readonly INSTANCE = new ApiFieldLog();
  public static readonly BODY_MAX = 256 * 1024;
  private constructor() {
    super();
  }

  public static dir(): string {
    // Beside the database (`TM_DB_FOLDER` — the e2e workers' temp dir, the embedded server's `db/`), or wherever
    // `TM_FIELD_LOG_DIR` says.
    return process.env.TM_FIELD_LOG_DIR ?? path.resolve(process.cwd(), process.env.TM_DB_FOLDER ?? './db', 'field-log');
  }

  public override post(req: Request, res: Response, ctx: Context): Promise<void> {
    return new Promise((resolve) => {
      let body = '';
      let overflow = false;
      req.on('data', (data) => {
        if (overflow) {
          return;
        }
        body += data.toString();
        if (body.length > ApiFieldLog.BODY_MAX) {
          overflow = true;
        }
      });
      req.once('end', () => {
        if (overflow) {
          responses.badRequest(req, res, 'field log rejected: too large');
          resolve();
          return;
        }
        let parsed: {kind?: unknown, record?: unknown};
        try {
          parsed = JSON.parse(body) as {kind?: unknown, record?: unknown};
        } catch {
          responses.badRequest(req, res, 'field log rejected: not JSON');
          resolve();
          return;
        }
        if (typeof parsed !== 'object' || parsed === null || typeof parsed.kind !== 'string' || typeof parsed.record !== 'object' || parsed.record === null) {
          responses.badRequest(req, res, 'field log rejected: no kind / record');
          resolve();
          return;
        }
        const at = new Date();
        const line = JSON.stringify({at: at.toISOString(), ip: ctx.ip, ...parsed});
        try {
          const dir = ApiFieldLog.dir();
          fs.mkdirSync(dir, {recursive: true});
          fs.appendFileSync(path.join(dir, `${at.toISOString().slice(0, 10)}.jsonl`), line + '\n');
        } catch (error) {
          responses.internalServerError(req, res, error);
          resolve();
          return;
        }
        responses.writeJson(res, ctx, {ok: true});
        resolve();
      });
    });
  }
}
