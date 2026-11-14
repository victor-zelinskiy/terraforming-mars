/*
 * THE BOTTLE'S DOOR TO NODE — how the client bundle reaches the server side (FREEZE ZERO · B3, the spike).
 *
 * The unit bundle is a `target: 'web'` webpack build: an `import` of `src/server` from a spec would be BUNDLED — the
 * whole engine through ts-loader, `fs` / `crypto` / `prom-client` unresolved for the web target. It does not have to
 * be: the bundle RUNS in node (mocha, under jsdom's globals), so the server is loaded the way the server runner loads
 * it — Node's own `require`, with tsx registered for TypeScript and the `@/` paths — and stays a module graph of its
 * own. Only TYPES are imported from it here (erased by the transpile).
 */
import type * as Host from './server/bottleServerHost';

type NodeRequire = (id: string) => unknown;
type NodeModuleApi = {createRequire(from: string): NodeRequire};
type NodeProcess = {cwd(): string, getBuiltinModule(id: string): unknown, hrtime: {bigint(): bigint}};

/** The process the bundle runs in — read off `globalThis` so webpack sees no `process` to shim. */
export function nodeProcess(): NodeProcess {
  return (globalThis as unknown as {process: NodeProcess}).process;
}

let required: NodeRequire | undefined;

/** Node's `require`, anchored at the repository root (the bundle itself lives in the OS temp folder). */
export function nodeRequire(): NodeRequire {
  if (required === undefined) {
    const nodeModule = nodeProcess().getBuiltinModule('node:module') as NodeModuleApi;
    const nodePath = nodeProcess().getBuiltinModule('node:path') as {join(...parts: Array<string>): string};
    required = nodeModule.createRequire(nodePath.join(nodeProcess().cwd(), 'package.json'));
  }
  return required;
}

let host: typeof Host | undefined;

/** The server side, loaded once per process (the engine's module state is the process's, as on a real server). */
export function bottleServer(): typeof Host {
  if (host === undefined) {
    const req = nodeRequire();
    // tsx's CommonJS hook: `.ts` through esbuild, the tsconfig's `@/` paths resolved — what `mocha --import=tsx` is.
    (req('tsx/cjs/api') as {register(): unknown}).register();
    host = req('./tests/client/bottle/server/bottleServerHost.ts') as typeof Host;
  }
  return host;
}
