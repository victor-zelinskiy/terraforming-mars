/*
 * WHICH FILE HAS WHICH DEBUG ID — read off the runtime itself.
 *
 * The release build stamps every script it ships with a debug id (`sentry-cli sourcemaps inject`, in the release
 * workflow): a snippet at the top of the file runs `globalThis._sentryDebugIds[new Error().stack] = '<id>'`, and the
 * file's source map — uploaded under the same id — is what turns `main.js:2:1834` back into `src/…:line`. The key of
 * that registry is a STACK STRING whose first frame is the file itself, so the file is read out of it here.
 *
 * A build that was not stamped (a local build, a test) has no registry: the answer is an empty map, and its stacks
 * simply stay as they are. Pure of everything but the object it is given.
 */

import {parseStack} from './stackFrames';

type Registry = {_sentryDebugIds?: Record<string, string>};

/** File / URL → debug id, for every stamped script this runtime has loaded so far. */
export function debugIdsOf(globalObject: unknown): Record<string, string> {
  const registry = (globalObject as Registry | undefined)?._sentryDebugIds;
  const out: Record<string, string> = {};
  if (registry === undefined || registry === null) {
    return out;
  }
  for (const [stack, id] of Object.entries(registry)) {
    const file = parseStack(stack)[0]?.file;
    if (file !== undefined && file !== '' && typeof id === 'string') {
      out[file] = id;
    }
  }
  return out;
}
