import {expect} from 'chai';
import {HostRegistry, LanHostInfo, LanTimings} from '../../src/server/embedded/lanDiscovery';

/**
 * THE HOST REGISTRY — every rule about which LAN couches exist, tested without
 * a socket or a multicast packet in sight (`lanDiscovery` keeps only plumbing
 * around it: browsers in, timer ticks, emits out).
 *
 * Two production bugs live in here as assertions, and both had the same shape —
 * *something stopped being mentioned, so we deleted it*:
 *
 *  1. `bonjour-service`'s Browser emits `up` ONCE per service. A "last seen"
 *     fed from it freezes at discovery, and the TTL sweep over it deleted every
 *     host 45 s after finding it, permanently (only an app restart brought it
 *     back). Symptom: play a LAN game, go back to the menu, and the host you
 *     were still talking to is not listed.
 *  2. The first fix then removed hosts that the browsers no longer listed —
 *     and `rebuildLinks()` (a Wi-Fi reconnect, a VPN toggle, a dock) destroys
 *     every Browser and builds fresh ones whose lists start EMPTY. Same wipe,
 *     new costume.
 *
 * Hence the contract: mDNS is how a host is FOUND; only a SOCKET may take it
 * away.
 */

const TIMINGS: LanTimings = {quietMs: 1_000, recheckMs: 5_000, reachTimeoutMs: 100};

function host(id: string, addresses: Array<string> = ['192.168.50.168'], port = 17325): LanHostInfo {
  return {id, name: id, addresses, port, version: ''};
}

/** A registry on a clock the test drives. */
function registry(): {reg: HostRegistry, tick: (ms: number) => void, at: () => number} {
  let now = 1_000_000;
  const reg = new HostRegistry(TIMINGS, () => now);
  return {reg, tick: (ms: number) => {
    now += ms;
  }, at: () => now};
}

describe('embedded/HostRegistry', () => {
  describe('presence is additive', () => {
    it('adopts what the browsers list', () => {
      const {reg} = registry();
      expect(reg.adopt([host('a'), host('b', ['192.168.50.169'])])).to.be.true;
      expect(reg.hosts().map((h) => h.id)).to.have.members(['a', 'b']);
    });

    it('re-adopting the same list changes nothing (no UI churn every 10 s)', () => {
      const {reg} = registry();
      reg.adopt([host('a')]);
      expect(reg.adopt([host('a')])).to.be.false;
    });

    it('⚠️ an EMPTY listing removes nothing — a rebuilt browser starts empty', () => {
      const {reg} = registry();
      reg.adopt([host('a')]);
      expect(reg.adopt([])).to.be.false;
      expect(reg.hosts().map((h) => h.id)).to.deep.eq(['a']);
    });

    it('⚠️ a host that has gone mDNS-quiet stays listed — silence is not absence', () => {
      const {reg, tick} = registry();
      reg.adopt([host('a')]);
      tick(10 * TIMINGS.quietMs);
      // No `up` will ever arrive again for this service. It must still be there.
      expect(reg.hosts().map((h) => h.id)).to.deep.eq(['a']);
      // ...and it must be up for a socket check.
      expect(reg.due().map((h) => h.id)).to.deep.eq(['a']);
    });

    it('picks up a record that changed (a renamed profile keeps its row)', () => {
      const {reg} = registry();
      reg.adopt([host('a')]);
      const renamed = {...host('a'), name: 'Victor'};
      expect(reg.markSeen(renamed)).to.be.true;
      expect(reg.hosts()[0].name).to.eq('Victor');
    });
  });

  describe('only a socket removes a host', () => {
    it('does not ask about a host that is still announcing', () => {
      const {reg, tick} = registry();
      reg.adopt([host('a')]);
      tick(TIMINGS.quietMs - 1);
      expect(reg.due()).to.be.empty;
    });

    it('survives ONE failed check — a dropped packet on a busy link costs nothing', () => {
      const {reg, tick} = registry();
      reg.adopt([host('a')]);
      tick(TIMINGS.quietMs);
      expect(reg.settle(host('a'), false)).to.be.false;
      expect(reg.hosts().map((h) => h.id)).to.deep.eq(['a']);
    });

    it('hides a host after the second failure, and says so', () => {
      const {reg, tick} = registry();
      reg.adopt([host('a')]);
      tick(TIMINGS.quietMs);
      reg.settle(host('a'), false);
      expect(reg.settle(host('a'), false), 'second strike').to.be.true;
      expect(reg.hosts()).to.be.empty;
      expect(reg.hiddenCount()).to.eq(1);
    });

    it('a successful check clears the strike count', () => {
      const {reg, tick} = registry();
      reg.adopt([host('a')]);
      tick(TIMINGS.quietMs);
      reg.settle(host('a'), false);
      reg.settle(host('a'), true);
      reg.settle(host('a'), false);
      // Would be the "second" failure if strikes had not been reset.
      expect(reg.hosts().map((h) => h.id)).to.deep.eq(['a']);
    });

    it('an mDNS goodbye removes it outright — that one IS authoritative', () => {
      const {reg} = registry();
      reg.adopt([host('a')]);
      expect(reg.goodbye('a')).to.be.true;
      expect(reg.hosts()).to.be.empty;
      expect(reg.goodbye('a')).to.be.false;
    });
  });

  describe('a hidden host is never forgotten', () => {
    function hidden(): ReturnType<typeof registry> {
      const ctx = registry();
      ctx.reg.adopt([host('a')]);
      ctx.tick(TIMINGS.quietMs);
      ctx.reg.settle(host('a'), false);
      ctx.reg.settle(host('a'), false);
      return ctx;
    }

    it('stays off the list, and off the browsers, yet still comes up for retry', () => {
      const ctx = hidden();
      expect(ctx.reg.due()).to.be.empty; // too soon
      ctx.tick(TIMINGS.recheckMs);
      // Note: nothing was adopted in between — the retry does not depend on the
      // browsers still listing it, which after a rebuild they would not.
      expect(ctx.reg.due().map((h) => h.id)).to.deep.eq(['a']);
    });

    it('returns the moment it answers again — no app restart', () => {
      const ctx = hidden();
      ctx.tick(TIMINGS.recheckMs);
      expect(ctx.reg.settle(host('a'), true)).to.be.true;
      expect(ctx.reg.hosts().map((h) => h.id)).to.deep.eq(['a']);
      expect(ctx.reg.hiddenCount()).to.eq(0);
    });

    it('returns on a fresh announcement too', () => {
      const ctx = hidden();
      expect(ctx.reg.markSeen(host('a'))).to.be.true;
      expect(ctx.reg.hosts().map((h) => h.id)).to.deep.eq(['a']);
      expect(ctx.reg.hiddenCount()).to.eq(0);
    });

    it('is not re-adopted by a browser listing while it is hidden', () => {
      const ctx = hidden();
      expect(ctx.reg.adopt([host('a')])).to.be.false;
      expect(ctx.reg.hosts()).to.be.empty;
    });
  });

  describe('one row per machine', () => {
    it('collapses a crashed instance ghost into its live successor', () => {
      const {reg, tick} = registry();
      // The ghost was adopted first (an app that died without a goodbye).
      reg.adopt([host('ghost')]);
      tick(100);
      // The machine's new process advertises the same endpoint under a new id.
      reg.markSeen(host('live'));
      expect(reg.hosts().map((h) => h.id)).to.deep.eq(['live']);
    });

    it('keeps two genuinely different couches apart', () => {
      const {reg} = registry();
      reg.adopt([host('a', ['192.168.50.10']), host('b', ['192.168.50.11'])]);
      expect(reg.hosts()).to.have.length(2);
    });
  });
});
