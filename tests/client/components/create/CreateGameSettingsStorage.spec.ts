import {expect} from 'chai';
import {CreateGameSettingsStorage} from '@/client/components/create/CreateGameSettingsStorage';
import {FakeLocalStorage} from '../FakeLocalStorage';

describe('CreateGameSettingsStorage', () => {
  let localStorage: FakeLocalStorage;
  let storage: CreateGameSettingsStorage;

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    storage = new CreateGameSettingsStorage(localStorage);
  });

  it('saves and reloads game settings, stripping clonedGamedId', () => {
    storage.saveSettings({
      players: [{name: 'Alice', color: 'red', beginner: false, handicap: 0}],
      board: 'hellas',
      clonedGamedId: 'g123',
      solarPhaseOption: true,
    });

    expect(storage.loadSettings()).deep.eq({
      players: [{name: 'Alice', color: 'red', beginner: false, handicap: 0}],
      board: 'hellas',
      solarPhaseOption: true,
    });
  });

  it('returns undefined when nothing is saved', () => {
    expect(storage.loadSettings()).eq(undefined);
  });

  it('ignores invalid saved data', () => {
    const warnings: Array<Array<unknown>> = [];
    const originalWarn = console.warn;
    console.warn = (...args) => {
      warnings.push(args);
    };
    localStorage.setItem('tm_last_game_settings', '{bad json');

    try {
      expect(storage.loadSettings()).eq(undefined);
    } finally {
      console.warn = originalWarn;
    }
    expect(warnings[0][0]).eq('Unable to load create game settings:');
  });

  it('clears saved settings', () => {
    storage.saveSettings({board: 'hellas', solarPhaseOption: true});

    storage.clearSettings();

    expect(storage.loadSettings()).eq(undefined);
  });

  it('is a safe no-op when the storage backend throws (locked-down origin)', () => {
    const throwing: Storage = {
      getItem() {
        throw new Error('SecurityError');
      },
      setItem() {
        throw new Error('SecurityError');
      },
      removeItem() {
        throw new Error('SecurityError');
      },
      clear() {
        throw new Error('SecurityError');
      },
      key() {
        return null;
      },
      length: 0,
    };
    const guarded = new CreateGameSettingsStorage(throwing);
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      expect(() => guarded.saveSettings({board: 'hellas'})).not.to.throw();
      expect(guarded.loadSettings()).eq(undefined);
      expect(() => guarded.clearSettings()).not.to.throw();
    } finally {
      console.warn = originalWarn;
    }
  });
});
