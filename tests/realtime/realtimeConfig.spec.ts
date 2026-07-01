import {expect} from 'chai';
import {
  realtimeClientEnabled,
  realtimePollReductionEnabled,
  realtimeRefreshEnabled,
} from '../../src/client/components/realtime/realtimeConfig';

// realtimeConfig reads the (browser) `window` (URL params + localStorage); stub
// it so the flag-resolution logic is testable under the server runner.
const g = global as unknown as {window?: unknown};

function stubWindow(search: string, storage: Record<string, string> = {}): void {
  g.window = {
    location: {search, protocol: 'https:', host: 'tm.example.com'},
    localStorage: {getItem: (k: string) => (k in storage ? storage[k] : null)},
  };
}

describe('realtime/realtimeConfig flags (Phase 12 default-ON)', () => {
  let saved: unknown;
  beforeEach(() => {
    saved = g.window;
  });
  afterEach(() => {
    g.window = saved;
  });

  it('transport defaults ON and cascades to refresh + poll reduction', () => {
    stubWindow('');
    expect(realtimeClientEnabled()).to.be.true;
    expect(realtimeRefreshEnabled()).to.be.true;
    expect(realtimePollReductionEnabled()).to.be.true;
  });

  it('?realtime=0 is the kill-switch — disables all three', () => {
    stubWindow('?realtime=0');
    expect(realtimeClientEnabled()).to.be.false;
    expect(realtimeRefreshEnabled()).to.be.false;
    expect(realtimePollReductionEnabled()).to.be.false;
  });

  it('?realtimeRefresh=0 keeps the transport but disables refresh + poll reduction', () => {
    stubWindow('?realtimeRefresh=0');
    expect(realtimeClientEnabled()).to.be.true;
    expect(realtimeRefreshEnabled()).to.be.false;
    expect(realtimePollReductionEnabled()).to.be.false;
  });

  it('?realtimePoll=0 keeps transport + refresh but disables poll reduction', () => {
    stubWindow('?realtimePoll=0');
    expect(realtimeClientEnabled()).to.be.true;
    expect(realtimeRefreshEnabled()).to.be.true;
    expect(realtimePollReductionEnabled()).to.be.false;
  });

  it('localStorage realtime_transport=0 disables the transport', () => {
    stubWindow('', {realtime_transport: '0'});
    expect(realtimeClientEnabled()).to.be.false;
  });
});
