import {expect} from 'chai';
import {
  LONG_POLL_MS,
  RealtimeHealthSnapshot,
  STALE_PONG_MS,
  isPongStale,
  isRealtimeHealthy,
  pollIntervalMs,
} from '../../src/client/components/realtime/pollPolicy';

const NOW = 1_000_000;

function snapshot(overrides: Partial<RealtimeHealthSnapshot> = {}): RealtimeHealthSnapshot {
  return {
    status: 'connected',
    helloAcked: true,
    subscribed: true,
    lastPongAt: NOW - 1_000,
    lastConnectedAt: NOW - 2_000,
    ...overrides,
  };
}

describe('realtime/pollPolicy', () => {
  describe('isRealtimeHealthy', () => {
    it('is true when connected, handshaked, subscribed and fresh', () => {
      expect(isRealtimeHealthy(snapshot(), NOW)).to.be.true;
    });

    it('is false while reconnecting / not connected', () => {
      expect(isRealtimeHealthy(snapshot({status: 'reconnecting'}), NOW)).to.be.false;
      expect(isRealtimeHealthy(snapshot({status: 'connecting'}), NOW)).to.be.false;
      expect(isRealtimeHealthy(snapshot({status: 'error'}), NOW)).to.be.false;
    });

    it('is false before hello / before subscription', () => {
      expect(isRealtimeHealthy(snapshot({helloAcked: false}), NOW)).to.be.false;
      expect(isRealtimeHealthy(snapshot({subscribed: false}), NOW)).to.be.false;
    });

    it('is false when the heartbeat is stale', () => {
      expect(isRealtimeHealthy(snapshot({lastPongAt: NOW - (STALE_PONG_MS + 1)}), NOW)).to.be.false;
    });

    it('accepts a post-connect grace before the first pong', () => {
      expect(isRealtimeHealthy(snapshot({lastPongAt: undefined, lastConnectedAt: NOW - 1_000}), NOW)).to.be.true;
      expect(isRealtimeHealthy(snapshot({lastPongAt: undefined, lastConnectedAt: NOW - (STALE_PONG_MS + 1)}), NOW)).to.be.false;
      expect(isRealtimeHealthy(snapshot({lastPongAt: undefined, lastConnectedAt: undefined}), NOW)).to.be.false;
    });
  });

  describe('pollIntervalMs', () => {
    it('stretches only when healthy AND reduction enabled', () => {
      expect(pollIntervalMs(true, true, 1_000)).to.eq(LONG_POLL_MS);
      expect(pollIntervalMs(true, false, 1_000)).to.eq(1_000);
      expect(pollIntervalMs(false, true, 1_000)).to.eq(1_000);
      expect(pollIntervalMs(false, false, 1_000)).to.eq(1_000);
    });

    it('never returns below the safe interval', () => {
      expect(pollIntervalMs(true, true, LONG_POLL_MS + 5_000)).to.eq(LONG_POLL_MS + 5_000);
    });
  });

  describe('isPongStale', () => {
    it('is false for a fresh pong and true past the threshold', () => {
      expect(isPongStale(NOW - 1_000, NOW - 2_000, NOW)).to.be.false;
      expect(isPongStale(NOW - (STALE_PONG_MS + 1), NOW - 2_000, NOW)).to.be.true;
    });

    it('falls back to lastConnectedAt when no pong yet', () => {
      expect(isPongStale(undefined, NOW - 1_000, NOW)).to.be.false;
      expect(isPongStale(undefined, NOW - (STALE_PONG_MS + 1), NOW)).to.be.true;
    });

    it('is false when there is nothing to measure', () => {
      expect(isPongStale(undefined, undefined, NOW)).to.be.false;
    });
  });
});
