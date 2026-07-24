import {expect} from 'chai';
import {
  profilesState,
  ensureProfilesLoaded,
  activeProfile,
  addProfile,
  renameProfile,
  setProfileColor,
  setActiveProfile,
  removeProfile,
  nextProfileColor,
  MAX_PROFILES,
} from '@/client/components/mainMenu/profilesState';
import {identityState} from '@/client/components/mainMenu/identity/identityState';

// The mochapack runner doesn't expose a localStorage global — install a minimal
// in-memory stub so the persist / reload / migrate path (the storage funnel) is
// exercised rather than silently skipped by its storageAvailable() guard.
if (typeof (globalThis as {localStorage?: unknown}).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as {localStorage?: unknown}).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k) : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

describe('profilesState', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
    profilesState.profiles = [];
    profilesState.activeId = undefined;
    profilesState.loaded = false;
    identityState.identity = undefined;
    identityState.loaded = false;
  });

  it('adds a profile, activates it, and mirrors it into the shared identity', () => {
    const result = addProfile('Alice');
    expect(result.ok).to.be.true;
    expect(profilesState.profiles).to.have.length(1);
    expect(activeProfile()?.displayName).to.eq('Alice');
    // The active profile is mirrored into identityState for the rest of the app.
    expect(identityState.identity?.displayName).to.eq('Alice');
  });

  it('de-duplicates names case-insensitively', () => {
    expect(addProfile('Victor').ok).to.be.true;
    expect(addProfile('  VICTOR ')).to.deep.eq({ok: false, reason: 'duplicate'});
    expect(profilesState.profiles).to.have.length(1);
  });

  it('rejects empty / too-short names', () => {
    expect(addProfile('   ')).to.deep.eq({ok: false, reason: 'empty'});
    expect(addProfile('a')).to.deep.eq({ok: false, reason: 'invalid'});
    expect(profilesState.profiles).to.have.length(0);
  });

  it('gives each new profile a distinct default colour', () => {
    addProfile('Alice');
    const c1 = activeProfile()?.cubeColor;
    addProfile('Bob');
    const c2 = activeProfile()?.cubeColor;
    expect(c1).to.not.eq(c2);
    expect(nextProfileColor()).to.not.be.oneOf([c1, c2]);
  });

  it('switches the active profile and re-mirrors the identity', () => {
    const a = addProfile('Alice');
    const b = addProfile('Bob');
    expect(a.ok && b.ok).to.be.true;
    if (!a.ok || !b.ok) {
      return;
    }
    expect(identityState.identity?.displayName).to.eq('Bob'); // newest is active
    setActiveProfile(a.id);
    expect(activeProfile()?.displayName).to.eq('Alice');
    expect(identityState.identity?.displayName).to.eq('Alice');
  });

  it('renames a profile, blocking a clash with another profile', () => {
    const a = addProfile('Alice');
    addProfile('Bob');
    if (!a.ok) {
      return;
    }
    expect(renameProfile(a.id, 'BOB')).to.deep.eq({ok: false, reason: 'duplicate'});
    expect(renameProfile(a.id, 'Alicia').ok).to.be.true;
    expect(profilesState.profiles.find((p) => p.id === a.id)?.displayName).to.eq('Alicia');
  });

  it('re-colours the active profile and mirrors the colour', () => {
    const a = addProfile('Alice', {color: 'red'});
    if (!a.ok) {
      return;
    }
    setProfileColor(a.id, 'blue');
    expect(activeProfile()?.cubeColor).to.eq('blue');
    expect(identityState.identity?.cubeColor).to.eq('blue');
  });

  it('refuses to remove the only profile', () => {
    const a = addProfile('Alice');
    if (!a.ok) {
      return;
    }
    expect(removeProfile(a.id)).to.deep.eq({ok: false, reason: 'last'});
    expect(profilesState.profiles).to.have.length(1);
  });

  it('removes a non-active profile, keeping the active one', () => {
    const a = addProfile('Alice');
    const b = addProfile('Bob'); // active
    if (!a.ok || !b.ok) {
      return;
    }
    expect(removeProfile(a.id).ok).to.be.true;
    expect(profilesState.profiles).to.have.length(1);
    expect(activeProfile()?.displayName).to.eq('Bob');
  });

  it('removing the active profile hands active status to a remaining one', () => {
    const a = addProfile('Alice');
    const b = addProfile('Bob'); // active
    if (!a.ok || !b.ok) {
      return;
    }
    expect(removeProfile(b.id).ok).to.be.true;
    expect(activeProfile()?.displayName).to.eq('Alice');
    expect(identityState.identity?.displayName).to.eq('Alice'); // re-mirrored
  });

  it('caps the roster at MAX_PROFILES', () => {
    for (let i = 0; i < MAX_PROFILES + 3; i++) {
      addProfile('Player' + i);
    }
    expect(profilesState.profiles).to.have.length(MAX_PROFILES);
    expect(addProfile('OneMore')).to.deep.eq({ok: false, reason: 'full'});
  });

  it('migrates a legacy single identity into the first profile', () => {
    // A fresh session whose only stored identity is the pre-roster key.
    localStorage.setItem('tm_player_identity', JSON.stringify({displayName: 'Legacy', cubeColor: 'purple'}));
    ensureProfilesLoaded();
    expect(profilesState.profiles).to.have.length(1);
    const migrated = activeProfile();
    expect(migrated?.displayName).to.eq('Legacy');
    expect(migrated?.cubeColor).to.eq('purple');
  });

  it('reloads a stored roster and mirrors the stored active profile', () => {
    localStorage.setItem('tm_player_profiles', JSON.stringify({
      profiles: [
        {id: 'a', displayName: 'Alice', cubeColor: 'red'},
        {id: 'b', displayName: 'Bob', cubeColor: 'blue'},
      ],
      activeId: 'b',
    }));
    ensureProfilesLoaded();
    expect(profilesState.profiles.map((p) => p.displayName)).to.deep.eq(['Alice', 'Bob']);
    expect(activeProfile()?.displayName).to.eq('Bob');
    expect(identityState.identity?.displayName).to.eq('Bob');
  });

  it('drops case-variant duplicate profiles + invalid names on reload', () => {
    localStorage.setItem('tm_player_profiles', JSON.stringify({
      profiles: [
        {id: 'a', displayName: 'Alice', cubeColor: 'red'},
        {id: 'b', displayName: 'ALICE', cubeColor: 'blue'},
        {id: 'c', displayName: 'x', cubeColor: 'green'},
        {id: 'd', displayName: 'Dave', cubeColor: 'yellow'},
      ],
      activeId: 'd',
    }));
    ensureProfilesLoaded();
    expect(profilesState.profiles.map((p) => p.displayName)).to.deep.eq(['Alice', 'Dave']);
  });
});
