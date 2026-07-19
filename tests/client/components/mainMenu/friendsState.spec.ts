import {expect} from 'chai';
import {
  friendsState,
  ensureFriendsLoaded,
  addFriend,
  removeFriend,
  isFriend,
  MAX_FRIENDS,
} from '@/client/components/mainMenu/friendsState';

// The mochapack runner doesn't expose a localStorage global — install a minimal
// in-memory stub so the persist / reload path (the module's storage funnel) is
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

describe('friendsState', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
    friendsState.friends = [];
    friendsState.loaded = false;
  });

  it('adds a valid friend', () => {
    expect(addFriend('Nastya')).to.deep.eq({ok: true});
    expect(friendsState.friends).to.deep.eq(['Nastya']);
  });

  it('rejects empty and too-short names', () => {
    expect(addFriend('   ')).to.deep.eq({ok: false, reason: 'empty'});
    expect(addFriend('a')).to.deep.eq({ok: false, reason: 'invalid'});
    expect(friendsState.friends).to.have.length(0);
  });

  it('de-duplicates case-insensitively (and by trimmed form)', () => {
    expect(addFriend('Victor').ok).to.be.true;
    expect(addFriend('  VICTOR ')).to.deep.eq({ok: false, reason: 'duplicate'});
    expect(friendsState.friends).to.deep.eq(['Victor']);
  });

  it('isFriend matches case-insensitively (incl. Cyrillic)', () => {
    addFriend('Виктор');
    expect(isFriend('вИкТоР')).to.be.true;
    expect(isFriend('Someone else')).to.be.false;
  });

  it('removes case-insensitively', () => {
    addFriend('Bob');
    removeFriend('BOB');
    expect(friendsState.friends).to.deep.eq([]);
  });

  it('caps the list at MAX_FRIENDS', () => {
    for (let i = 0; i < MAX_FRIENDS + 5; i++) {
      addFriend('Friend' + i);
    }
    expect(friendsState.friends).to.have.length(MAX_FRIENDS);
    expect(addFriend('OneMore')).to.deep.eq({ok: false, reason: 'full'});
  });

  it('reloads from storage, dropping legacy case-variant duplicates and invalid names', () => {
    // A fresh session with a legacy stored list that has a case-variant dupe + a too-short name.
    localStorage.setItem('tm_friends', JSON.stringify(['Alice', 'ALICE', 'Dave', 'x']));
    friendsState.loaded = false;
    friendsState.friends = [];
    ensureFriendsLoaded();
    expect(friendsState.friends).to.deep.eq(['Alice', 'Dave']);
  });
});
