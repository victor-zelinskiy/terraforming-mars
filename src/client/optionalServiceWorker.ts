/*
 * THE SERVICE WORKER IS OPTIONAL — its registration never fails the page.
 *
 * `sw.js` is an empty worker: it exists only so a page may call `registration.showNotification` («your turn» while
 * the tab is in the background). A browser may refuse or fail to start it for reasons that are none of the game's —
 * a worker thread that did not come up on a loaded machine («ServiceWorker script evaluation failed»), a profile
 * with workers off, storage blocked. The registration's promise then REJECTS, and with nobody on it the rejection is
 * an unhandled one on every page: a page error for the collector and for every e2e spec that asserts «no page
 * errors» (issue #83 — a spec red on a line of the browser's own).
 *
 * Service workers are only supported on http/https origins. Under the Electron desktop shell's custom `app://`
 * scheme (and file://) registration is unsupported and the worker is a no-op anyway, so it is skipped there — the
 * browser's behaviour stays identical and Electron never sees a rejected registration.
 */
type WorkerHost = {
  isSecureContext: boolean,
  location: {protocol: string},
};
type WorkerContainer = {
  register(script: string): Promise<unknown>,
};

/** May this page register a worker at all? */
export function serviceWorkerSupported(host: WorkerHost, container: WorkerContainer | undefined): container is WorkerContainer {
  const scheme = host.location.protocol;
  return container !== undefined && host.isSecureContext && (scheme === 'http:' || scheme === 'https:');
}

/**
 * Register the worker — `'registered'`, `'unsupported'` (nothing asked), or `'refused'` when the browser would not:
 * the page goes on without background notifications. NEVER rejects.
 */
export async function registerOptionalServiceWorker(host: WorkerHost, container: WorkerContainer | undefined): Promise<'registered' | 'unsupported' | 'refused'> {
  if (!serviceWorkerSupported(host, container)) {
    return 'unsupported';
  }
  try {
    const registration = await container.register('sw.js');
    console.log('registered the service worker', registration);
    return 'registered';
  } catch (err) {
    // Swallowed on purpose (an optional platform call — `.claude/rules/diagnostics.md`, law 22): the worker is the
    // browser's to start, the game runs whole without it, and only background notifications are lost. Said as a
    // plain line for whoever reads the console; it is no error of the game.
    console.log('the service worker was not registered — background notifications are off for this page', err);
    return 'refused';
  }
}
