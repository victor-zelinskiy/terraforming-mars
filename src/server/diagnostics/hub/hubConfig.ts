/*
 * WHETHER THIS RUN SENDS ANYTHING, AND AS WHAT — decided once, from facts, by a pure function.
 *
 * The rule the whole feature stands on: **only a packaged release that was BUILT with a destination sends** — a local
 * build, a development run, a unit test and an e2e run have no destination and therefore send nothing, whatever else
 * is true. The destination (the DSN) is baked into `settings.json` by the release workflow from an Actions variable
 * (`TM_SENTRY_DSN`); a fork's build has none.
 *
 * The ENVIRONMENT separates the owner's own machine from the players': `box` is a fact of the MACHINE
 * (`<userData>/diagnostics.json` = `{"environment": "box"}` — app data, not the launch wrapper, which a shared
 * installer generates for everybody), `production` is every other release.
 */

export type HubConfigInput = {
  /** `app.isPackaged`. */
  packaged: boolean;
  /** `settings.json` → `sentryDsn` ('' / absent = this build has no destination). */
  dsn: string | undefined;
  /** The app's version (`package.json`). */
  version: string;
  /** The parsed `<userData>/diagnostics.json` (undefined = absent or unreadable). */
  machineFile: {environment?: unknown} | undefined;
  env: Readonly<Record<string, string | undefined>>;
};

export type HubConfig = {
  /** A destination exists and this run may use it. */
  sends: boolean;
  /** Why not ('' when `sends`) — printed once at start, shown in the status readout. */
  why: string;
  dsn: string;
  environment: string;
  /** `terraforming-mars@<version>`. */
  release: string;
};

export const RELEASE_PREFIX = 'terraforming-mars@';

const ENVIRONMENT = /^[a-z][a-z0-9-]{1,30}$/;

export function resolveHubConfig(input: HubConfigInput): HubConfig {
  const release = `${RELEASE_PREFIX}${input.version}`;
  const dsn = (input.dsn ?? '').trim();
  const off = (why: string): HubConfig => ({sends: false, why, dsn: '', environment: 'development', release});
  // A test run never sends — whatever the build is (a packaged build driven by an e2e harness included).
  if ((input.env.TM_DIAG_OFF ?? '') === '1' || input.env.TM_E2E_HOST !== undefined || input.env.PLAYWRIGHT_TEST_BASE_URL !== undefined ||
      input.env.NODE_ENV === 'test') {
    return off('a test run');
  }
  // The one door for a developer proving the pipeline from a local build: an explicit DSN in the environment.
  const forced = (input.env.TM_DIAG_DSN ?? '').trim();
  if (forced !== '') {
    return {sends: true, why: '', dsn: forced, environment: environmentOf(input, 'development'), release};
  }
  if (!input.packaged) {
    return off('not a packaged release');
  }
  if (dsn === '') {
    return off('this build has no destination');
  }
  return {sends: true, why: '', dsn, environment: environmentOf(input, 'production'), release};
}

function environmentOf(input: HubConfigInput, fallback: string): string {
  const fromEnv = (input.env.TM_DIAG_ENV ?? '').trim().toLowerCase();
  if (ENVIRONMENT.test(fromEnv)) {
    return fromEnv;
  }
  const fromFile = typeof input.machineFile?.environment === 'string' ? input.machineFile.environment.trim().toLowerCase() : '';
  return ENVIRONMENT.test(fromFile) ? fromFile : fallback;
}

/** `https://<key>@<host>/<project>` → where envelopes and minidumps go. Undefined for anything else. */
export function parseDsn(dsn: string): {key: string, host: string, projectId: string, envelopeUrl: string, minidumpUrl: string} | undefined {
  const m = /^(https?):\/\/([0-9a-f]+)@([^/]+)\/(\d+)$/i.exec(dsn.trim());
  if (m === null) {
    return undefined;
  }
  const [, scheme, key, host, projectId] = m;
  const base = `${scheme}://${host}/api/${projectId}`;
  return {
    key, host, projectId,
    envelopeUrl: `${base}/envelope/?sentry_key=${key}&sentry_version=7&sentry_client=tm.diagnostics%2F1`,
    minidumpUrl: `${base}/minidump/?sentry_key=${key}`,
  };
}
