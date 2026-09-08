/**
 * THE E2E TEST OBJECT — every spec imports `test`/`expect` from HERE, never
 * from '@playwright/test' (guarded by e2eDriverGuard § ⑤).
 *
 * WHY (docs/E2E_ARCHITECTURE_REWORK.md phase 3 — isolation & parallelism):
 * the suite used to share ONE server and ONE ./db/game.db across every worker
 * and every run — concurrent runs contaminated each other (measured), the DB
 * grew to 895 MB and polluted list-shaped specs, and the whole suite was
 * pinned to workers=1. This fixture gives each Playwright worker its OWN
 * server process on its OWN port with its OWN throwaway SQLite folder:
 *
 *   · port  = TM_E2E_PORT_BASE (default 8100) + workerIndex
 *   · db    = a fresh temp dir per worker (TM_DB_FOLDER — SQLite.ts)
 *   · baseURL (page.goto AND the `request` fixture) points at that server
 *   · process.env.TM_E2E_BASE_URL carries it to non-fixture helpers
 *     (campaignFixtures etc.) — safe because each worker is its own process.
 *
 * Contamination is now structurally impossible: nothing is shared but the
 * build. Escape hatch: TM_E2E_SHARED_SERVER=1 reuses BASE_URL (default
 * http://localhost:8080) the old way — for debugging against a dev server.
 *
 * The server binary must be BUILT (`npm run build:server` at least) — the
 * spawn runs `node build/src/server/server.js` from the repo root, exactly
 * what `npm start` runs. Its output lands in test-results/worker-servers/
 * so a boot failure is diagnosable, not a silent 60 s timeout.
 */
import {test as base} from '@playwright/test';
import {ChildProcess, spawn} from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';

export * from '@playwright/test';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SERVER_ENTRY = path.join(REPO_ROOT, 'build', 'src', 'server', 'server.js');

type WorkerServer = {baseURL: string};

function httpOk(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2_000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(url: string, child: ChildProcess, logFile: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`worker server exited with ${child.exitCode} before answering — see ${logFile}`);
    }
    if (await httpOk(url)) {
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`worker server never answered at ${url} in ${timeoutMs} ms — see ${logFile}`);
}

export const test = base.extend<{}, {workerServer: WorkerServer}>({
  // eslint-disable-next-line no-empty-pattern -- Playwright's fixture signature
  workerServer: [async ({}, use, workerInfo) => {
    if (process.env.TM_E2E_SHARED_SERVER === '1') {
      const baseURL = process.env.BASE_URL ?? 'http://localhost:8080';
      process.env.TM_E2E_BASE_URL = baseURL;
      await use({baseURL});
      return;
    }
    const portBase = Number(process.env.TM_E2E_PORT_BASE ?? 8100);
    const port = portBase + workerInfo.workerIndex;
    const baseURL = `http://localhost:${port}`;
    const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), `tm-e2e-w${workerInfo.workerIndex}-`));
    const logDir = path.join(REPO_ROOT, 'test-results', 'worker-servers');
    fs.mkdirSync(logDir, {recursive: true});
    const logFile = path.join(logDir, `worker-${workerInfo.workerIndex}.log`);
    const log = fs.openSync(logFile, 'a');
    const child = spawn(process.execPath, [SERVER_ENTRY], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        PORT: String(port),
        TM_DB_FOLDER: dbDir,
        // The worker server is private to this run — never announce it on the
        // LAN or take part in discovery side-effects.
        TM_E2E_WORKER: String(workerInfo.workerIndex),
      },
      stdio: ['ignore', log, log],
    });
    try {
      await waitForServer(baseURL + '/', child, logFile, 90_000);
      process.env.TM_E2E_BASE_URL = baseURL;
      await use({baseURL});
    } finally {
      fs.closeSync(log);
      child.kill();
      // The DB dir is throwaway by design; removal is best-effort (Windows can
      // hold the file an instant past the kill).
      try {
        fs.rmSync(dbDir, {recursive: true, force: true, maxRetries: 3});
      } catch {
        // leave the temp dir to the OS
      }
    }
  }, {scope: 'worker'}],

  baseURL: async ({workerServer}, use) => {
    await use(workerServer.baseURL);
  },
});
