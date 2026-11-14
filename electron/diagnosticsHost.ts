/*
 * THE HUB'S TWO TYPES, AS THE ELECTRON LANE SEES THEM — a hand-kept mirror of `src/server/diagnostics/hub/hubTypes.ts`.
 *
 * The Electron lane compiles `electron/**` alone (its tsconfig's `rootDir` — no `src/`), so it cannot import the
 * hub's own declarations; the hub itself arrives as a BUNDLE (`build/electron/diagnostics-hub.js`, built by
 * `webpack.diagnostics.config.js`) that this lane `require`s at run time. These are the same two types, repeated.
 *
 * ⚠ KEEP THEM IDENTICAL. `tests/electron/diagnosticsHubConform.spec.ts` proves the two declarations assignable in
 * both directions — a member added on one side fails `npm run build:test` until the other side has it.
 */

export type HubHost = {
  /** The app's version (`package.json`) and whether this is a packaged release. */
  version: string;
  packaged: boolean;
  /** `settings.json` of the build: its commit, and the destination the release was built with. */
  head: string;
  dsn: string;
  /** `win32` / `linux` / `darwin`, the OS release, the CPU architecture. */
  platform: string;
  osVersion: string;
  arch: string;
  runtimeName: string;
  runtimeVersion: string;
  /** Where the hub keeps its files (`<userData>` — it uses `<userData>/diagnostics/` and reads `<userData>/diagnostics.json`). */
  dataDir: string;
  env: Readonly<Record<string, string | undefined>>;
  /** `host` — the game server runs on this device; `remote` — a thin client. Asked each time (it can be downgraded at start). */
  appMode(): 'host' | 'remote' | 'web';
  /** An HTTPS POST (the platform's own network stack — it knows the system proxy). */
  request(url: string, init: {method: 'POST', headers: Record<string, string>, body: Uint8Array}): Promise<{status: number, headers: Record<string, string | undefined>}>;
  /** Tell the page (a no-op while no page stands). */
  push(event: unknown): void;
  /** Keep the frame on screen now; answer whether one is held. */
  holdScreen(): Promise<boolean>;
  dropScreen(): void;
  /** The held frame as a JPEG no wider than 1920 px (undefined = none held, or this host has no screen). */
  heldScreenJpeg(): Promise<Uint8Array | undefined>;
  /** The renderer's whole console, with its digests (undefined = this host has none). */
  consoleDump(): Promise<string | undefined>;
  /**
   * The save of the game a SEAT belongs to, when this device hosts it (undefined = not hosted here / not found). Asked
   * by the seat: a page knows its participant id and never the game's.
   */
  readSave(participantId: string): Promise<{gameId: string, data: Uint8Array} | undefined>;
  /** Tails of the logs beside the game: the embedded server's, the main process's, the launch wrapper's. */
  logTails(maxBytes: number): Promise<Array<{name: string, text: string}>>;
  /** The newest hang trace not older than `sinceMs` (undefined = none). */
  recentHangTrace(sinceMs: number, maxBytes: number): Promise<{name: string, data: Uint8Array} | undefined>;
  /** Ask the game server this device runs to throw its test error; resolves when it was asked (false = no server here). */
  serverSelfTest(): Promise<boolean>;
  /** A test error thrown inside the host's own code (so its stack proves the host's maps). */
  hostSelfTestError(): Error;
  copyToClipboard(text: string): void;
  /** The crash uploader follows the player's choice. */
  setCrashUpload(enabled: boolean): void;
  log(line: string): void;
};

export type DiagnosticsHub = {
  /** A question of the page (`protocol.ts` `DiagInvoke`); an unknown verb answers `undefined`. */
  invoke(verb: string, payload: unknown): Promise<unknown>;
  /** A one-way line of the page (`protocol.ts` `DiagSend`). */
  line(payload: unknown): void;
  /**
   * A signal born outside the page: a console line of the host process (`main`) or of the game server (`server`), with
   * the stack of its error and the debug ids of the runtime that printed it.
   */
  note(runtime: 'main' | 'server', level: 'warn' | 'error', text: string, stack?: string, debugIds?: Readonly<Record<string, string>>): void;
  /** Where the crash uploader sends minidumps (undefined = this run sends nothing), and whether it may right now. */
  crashSubmitUrl(): string | undefined;
  crashUploadAllowed(): boolean;
  /** What the crash uploader attaches to a minidump (the release, the environment — never an id). */
  crashExtra(): Record<string, string>;
  /** The developer's key was pressed. */
  openJournal(): void;
  /** The app is quitting: what can still leave, leaves (bounded by the caller). */
  shutdown(): Promise<void>;
};
