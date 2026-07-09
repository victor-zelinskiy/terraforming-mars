import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {FakeLocalStorage} from '../FakeLocalStorage';
import {CreateGameSettingsStorage} from '@/client/components/create/CreateGameSettingsStorage';
import {
  createGameState,
  resetCreateGameState,
  saveCreateGameState,
  restoreCreateGameState,
  clearSavedCreateGameState,
} from '@/client/components/create/premium/createGameState';

describe('premium create — settings persistence', () => {
  let backend: FakeLocalStorage;
  let storage: CreateGameSettingsStorage;

  beforeEach(() => {
    backend = new FakeLocalStorage();
    storage = new CreateGameSettingsStorage(backend);
    resetCreateGameState();
  });

  it('saves the current setup and restores it later', () => {
    createGameState.config.mapMode = 'specific';
    createGameState.config.mapId = BoardName.HELLAS;
    createGameState.config.rules.draftVariant = false;
    createGameState.config.selectedExpansions.venus = false;
    createGameState.config.players[0].name = 'Alice';
    createGameState.config.players[1].name = 'Bob';

    saveCreateGameState(storage);
    resetCreateGameState();
    // The reset baseline differs, so the restore is a real change.
    expect(createGameState.config.mapMode).eq('random-all');

    expect(restoreCreateGameState(storage)).is.true;
    expect(createGameState.config.mapMode).eq('specific');
    expect(createGameState.config.mapId).eq(BoardName.HELLAS);
    expect(createGameState.config.rules.draftVariant).eq(false);
    expect(createGameState.config.selectedExpansions.venus).eq(false);
    expect(createGameState.config.players.map((p) => p.name)).deep.eq(['Alice', 'Bob']);
  });

  it('returns false and leaves the state untouched when nothing is saved', () => {
    const before = JSON.stringify(createGameState.config);
    expect(restoreCreateGameState(storage)).is.false;
    expect(JSON.stringify(createGameState.config)).eq(before);
  });

  it('persists only the config (no transient / seed / cloned-game fields)', () => {
    createGameState.creating = true;
    createGameState.error = 'boom';
    createGameState.mapPickerOpen = true;

    saveCreateGameState(storage);
    const saved = storage.loadSettings();

    expect(saved).is.not.undefined;
    expect(Object.keys(saved!).sort()).deep.eq(
      ['botDifficulty', 'gameMode', 'mapId', 'mapMode', 'players', 'rules', 'selectedExpansions'].sort());
    expect(saved).to.not.have.property('creating');
    expect(saved).to.not.have.property('error');
    expect(saved).to.not.have.property('mapPickerOpen');
    expect(saved).to.not.have.property('info');
    expect(saved).to.not.have.property('seed');
    expect(saved).to.not.have.property('clonedGamedId');
  });

  it('safely restores a partial / stale / invalid blob', () => {
    storage.saveSettings({
      gameMode: 'marsbot',
      botDifficulty: 'nonsense',
      mapMode: 'specific',
      mapId: 'not-a-board',
      selectedExpansions: {venus: true, notARealExpansion: true},
      rules: {draftVariant: false, bogusRule: true},
      players: [{name: 'Solo', color: 'green'}],
      someRemovedField: 123,
    } as any);

    expect(restoreCreateGameState(storage)).is.true;
    // marsbot → exactly one human seat.
    expect(createGameState.config.players).has.length(1);
    expect(createGameState.config.players[0].name).eq('Solo');
    expect(createGameState.config.players[0].color).eq('green');
    // Invalid difficulty / map fall back to the defaults.
    expect(createGameState.config.botDifficulty).eq('normal');
    expect(createGameState.config.mapId).eq(BoardName.THARSIS);
    // A known rule is applied; an unknown one is dropped.
    expect(createGameState.config.rules.draftVariant).eq(false);
    expect((createGameState.config.rules as any).bogusRule).eq(undefined);
    // A known expansion is applied; an unknown one is dropped.
    expect(createGameState.config.selectedExpansions.venus).eq(true);
    expect((createGameState.config.selectedExpansions as any).notARealExpansion).eq(undefined);
  });

  it('de-duplicates player colours from a corrupt blob', () => {
    storage.saveSettings({
      players: [
        {name: 'A', color: 'red'},
        {name: 'B', color: 'red'},
        {name: 'C', color: 'red'},
      ],
    } as any);

    expect(restoreCreateGameState(storage)).is.true;
    const colors = createGameState.config.players.map((p) => p.color);
    expect(new Set(colors).size).eq(colors.length);
    expect(createGameState.config.players.map((p) => p.name)).deep.eq(['A', 'B', 'C']);
  });

  it('falls back to default players when the blob has no valid player list', () => {
    storage.saveSettings({players: 'oops', mapMode: 'specific', mapId: BoardName.HELLAS} as any);

    expect(restoreCreateGameState(storage)).is.true;
    expect(createGameState.config.players.length).is.gte(2);
    expect(createGameState.config.mapId).eq(BoardName.HELLAS);
  });

  it('clearSavedCreateGameState forgets the saved setup', () => {
    saveCreateGameState(storage);
    expect(storage.loadSettings()).is.not.undefined;

    clearSavedCreateGameState(storage);
    expect(storage.loadSettings()).eq(undefined);
  });
});
