import {expect} from 'chai';
import {createServer, Server} from 'net';
import {LanDiscovery, LanHostInfo} from '../../src/server/embedded/lanDiscovery';

/**
 * THE REAL THING: two `LanDiscovery` instances in one process, real multicast
 * over loopback, real TCP liveness checks. Run it with `npm run test:integration`
 * — it is deliberately OUT of the default suite, because a CI runner has no
 * usable multicast interface and this would be a permanent flake there.
 *
 * `tests/electron/lanHostRegistry.spec.ts` covers every DECISION without
 * sockets; this covers the WIRING those decisions hang off, which is exactly
 * what shipped broken twice:
 *
 *  1. `bonjour-service`'s Browser emits `up` once per service, so a "last seen"
 *     fed from it froze at discovery and the TTL sweep deleted every host 45 s
 *     later, permanently — a LAN host vanished from «Мои партии» mid-session
 *     and only an app restart brought it back.
 *  2. The first fix removed hosts the browsers no longer listed, which a link
 *     rebuild (Wi-Fi / VPN / dock) makes empty — the same wipe again.
 *
 * The timings are injected, so what takes 45 s in production takes 2 s here.
 */

const QUIET_MS = 1_500;
const RECHECK_MS = 2_000;
const PORT = 18_326;

/** Poll until `predicate` holds, or fail with what was actually seen. */
async function until(predicate: () => boolean, budgetMs: number, describe: () => string): Promise<void> {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  expect.fail(`timed out after ${budgetMs}ms — ${describe()}`);
}

// Real multicast + real sockets: minutes, not milliseconds. Run with
// `npm run test:integration`, which passes --no-timeouts.
describe('embedded/lanDiscovery over real multicast', () => {
  let host: LanDiscovery | undefined;
  let guest: LanDiscovery | undefined;
  let listener: Server | undefined;
  let seen: Array<LanHostInfo> = [];

  const named = () => seen.filter((h) => h.name === 'IntegrationHost');
  const report = () => `hosts=[${seen.map((h) => h.name).join(', ')}]`;

  beforeEach(async () => {
    seen = [];
    listener = createServer((socket) => socket.end());
    await new Promise<void>((resolve) => listener?.listen(PORT, resolve));
    const timings = {quietMs: QUIET_MS, recheckMs: RECHECK_MS, reachTimeoutMs: 500};
    host = new LanDiscovery(() => {}, {loopback: true, timings});
    guest = new LanDiscovery((hosts) => {
      seen = hosts;
    }, {loopback: true, timings});
    host.advertise({name: 'IntegrationHost', port: PORT, version: 'test'});
    guest.browse();
  });

  afterEach(() => {
    guest?.destroy();
    host?.destroy();
    listener?.close();
  });

  it('finds a host, and KEEPS it long past the mDNS quiet window', async () => {
    await until(() => named().length === 1, 20_000, () => `never discovered — ${report()}`);

    // The window that used to delete it. The Browser will not announce this
    // service again for the life of the process; the socket is what keeps it.
    await new Promise((resolve) => setTimeout(resolve, QUIET_MS * 3));
    expect(named(), `the host was dropped while still reachable — ${report()}`).to.have.length(1);
    expect(named()[0].port).to.eq(PORT);
  });

  it('drops a host once its SOCKET stops answering, and takes it back when it returns', async () => {
    await until(() => named().length === 1, 20_000, () => `never discovered — ${report()}`);

    // Silence the machine completely: no advertisement, nothing listening.
    host?.destroy();
    host = undefined;
    await new Promise<void>((resolve) => listener?.close(() => resolve()));
    listener = undefined;
    await until(() => named().length === 0, 20_000, () => `a dead host stayed listed — ${report()}`);

    // ...and it comes back on its own, without restarting the app: the hidden
    // host stays on the re-check rotation.
    listener = createServer((socket) => socket.end());
    await new Promise<void>((resolve) => listener?.listen(PORT, resolve));
    await until(() => named().length === 1, 20_000, () => `a returning host stayed hidden — ${report()}`);
  });
});
