import {expect} from 'chai';
import {evaluateInstaller, sha256} from '../../electron/installerCheck';

describe('electron/installerCheck evaluateInstaller', () => {
  it('flags a hash MISMATCH between the stamp and the live installer', () => {
    const n = evaluateInstaller({stampedSha: 'aaa', remoteSha: 'bbb', launchedByWrapper: true});
    expect(n.stale).to.equal(true);
    expect(n.reason).to.equal('installer-changed');
  });

  it('is NOT stale when the stamp matches the live installer (case-insensitive)', () => {
    const n = evaluateInstaller({stampedSha: 'ABC123', remoteSha: 'abc123', launchedByWrapper: true});
    expect(n.stale).to.equal(false);
    expect(n.reason).to.equal(undefined);
  });

  it('never false-alarms when the remote hash is unavailable (offline / fetch failed)', () => {
    const n = evaluateInstaller({stampedSha: 'abc', remoteSha: undefined, launchedByWrapper: true});
    expect(n.stale).to.equal(false);
  });

  it('nudges a LEGACY wrapper (launched by a wrapper but carrying no stamp)', () => {
    const n = evaluateInstaller({stampedSha: undefined, remoteSha: undefined, launchedByWrapper: true});
    expect(n.stale).to.equal(true);
    expect(n.reason).to.equal('legacy-wrapper');
  });

  it('stays silent when NOT launched by a wrapper and unstamped (desktop / web)', () => {
    const n = evaluateInstaller({stampedSha: undefined, remoteSha: undefined, launchedByWrapper: false});
    expect(n.stale).to.equal(false);
  });

  it('sha256 is stable + differs for different content', () => {
    expect(sha256('a')).to.equal(sha256('a'));
    expect(sha256('a')).to.not.equal(sha256('b'));
    expect(sha256('a')).to.match(/^[0-9a-f]{64}$/);
  });
});
